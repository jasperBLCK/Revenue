import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_manager
from app.core.database import get_db
from app.models.lead import Lead as LeadModel
from app.models.lead import LeadStatus
from app.models.manager import Manager
from app.schemas.ai import (
    AiNextAction,
    AiScore,
    AiSummary,
    AssistantQuery,
    GeneratedReply,
    GenerateReplyRequest,
    GrowRevenueItem,
    GrowRevenuePlan,
)
from app.schemas.lead import AssistantResponse
from app.schemas.lead import Lead as LeadSchema
from app.services.ai import ai_service
from app.services.leads import load_messages, refresh_lead_insights
from app.services.scoring import DEAL_VALUE_USD, bucket_for_lead

router = APIRouter(tags=["AI"])


async def _get_lead_or_404(db: AsyncSession, lead_id: uuid.UUID) -> LeadModel:
    result = await db.execute(
        select(LeadModel).options(selectinload(LeadModel.topic)).where(LeadModel.id == lead_id)
    )
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.get("/leads/{lead_id}/ai/score", response_model=AiScore)
async def get_score(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> AiScore:
    lead = await _get_lead_or_404(db, lead_id)
    await refresh_lead_insights(db, lead)
    return AiScore(
        purchase_probability=lead.ai_purchase_probability,
        churn_risk=lead.ai_churn_risk,
        interest_level=lead.ai_interest_level,
        reasons=lead.ai_reasons,
        updated_at=lead.ai_score_updated_at,
    )


@router.get("/leads/{lead_id}/ai/summary", response_model=AiSummary)
async def get_summary(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> AiSummary:
    lead = await _get_lead_or_404(db, lead_id)
    await refresh_lead_insights(db, lead)
    return AiSummary(
        lead_id=lead.id,
        bullets=lead.ai_summary_bullets,
        sentiment=lead.ai_sentiment or "neutral",
        updated_at=lead.ai_summary_updated_at,
    )


@router.get("/leads/{lead_id}/ai/next-action", response_model=AiNextAction)
async def get_next_action(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> AiNextAction:
    lead = await _get_lead_or_404(db, lead_id)
    await refresh_lead_insights(db, lead)
    score = {
        "purchase_probability": lead.ai_purchase_probability,
        "churn_risk": lead.ai_churn_risk,
        "interest_level": lead.ai_interest_level,
    }
    action = ai_service.next_action(lead, score)
    return AiNextAction(**action)


@router.post("/leads/{lead_id}/ai/generate-reply", response_model=GeneratedReply)
async def generate_reply(
    lead_id: uuid.UUID,
    payload: GenerateReplyRequest,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> GeneratedReply:
    lead = await _get_lead_or_404(db, lead_id)
    messages = await load_messages(db, lead.id)
    text = await ai_service.generate_reply(lead, messages, payload.tone, payload.instruction)
    return GeneratedReply(text=text, tone=payload.tone)


@router.post("/ai/assistant", response_model=AssistantResponse)
async def assistant(
    payload: AssistantQuery,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> AssistantResponse:
    result = await db.execute(
        select(LeadModel)
        .options(selectinload(LeadModel.topic))
        .order_by(LeadModel.ai_purchase_probability.desc())
    )
    leads = list(result.scalars().all())

    # Pick the leads most relevant to common manager questions.
    q = payload.query.lower()
    if any(w in q for w in ("купить", "готов", "горяч", "buy", "hot")):
        related = [lead for lead in leads if bucket_for_lead(lead) == "hot"]
    elif any(w in q for w in ("уйти", "риск", "остыл", "churn", "risk")):
        related = [lead for lead in leads if bucket_for_lead(lead) == "at_risk"]
    elif any(w in q for w in ("не отвеч", "забыт", "давно", "ghost")):
        related = [lead for lead in leads if bucket_for_lead(lead) == "ghost"]
    elif any(w in q for w in ("сегодня", "написать", "дожать", "follow", "today")):
        related = [lead for lead in leads if bucket_for_lead(lead) in ("hot", "follow_up")]
    else:
        related = leads[:10]
    related = related[:10]

    context = "\n".join(
        f"- {lead.name}: покупка {lead.ai_purchase_probability:.0%}, "
        f"риск ухода {lead.ai_churn_risk:.0%}, статус {lead.status.value}"
        for lead in related
    ) or "Нет подходящих лидов."
    answer = await ai_service.assistant_answer(payload.query, context)
    return AssistantResponse(
        answer=answer, related_leads=[LeadSchema.from_model(lead) for lead in related]
    )


@router.post("/ai/grow-revenue", response_model=GrowRevenuePlan)
async def grow_revenue(
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> GrowRevenuePlan:
    result = await db.execute(select(LeadModel).options(selectinload(LeadModel.topic)))
    leads = list(result.scalars().all())

    hot = [lead for lead in leads if bucket_for_lead(lead) == "hot"]
    at_risk = [lead for lead in leads if bucket_for_lead(lead) == "at_risk"]
    ghost = [lead for lead in leads if bucket_for_lead(lead) == "ghost"]
    follow_up = [lead for lead in leads if bucket_for_lead(lead) == "follow_up"]

    potential = round(
        DEAL_VALUE_USD * (len(hot) + 0.5 * len(at_risk) + 0.3 * len(ghost)), 2
    )

    items: list[GrowRevenueItem] = []
    if ghost:
        items.append(
            GrowRevenueItem(
                title=f"{len(ghost)} забытых лидов",
                detail=f"Потенциальная выручка: ${round(DEAL_VALUE_USD * 0.3 * len(ghost)):,}. "
                "Верните их коротким follow-up.",
                lead_ids=[lead.id for lead in ghost[:25]],
            )
        )
    if hot:
        items.append(
            GrowRevenueItem(
                title=f"{len(hot)} клиентов готовы купить прямо сейчас",
                detail="Свяжитесь сегодня и предложите оформить сделку.",
                lead_ids=[lead.id for lead in hot[:25]],
            )
        )
    proposal_leads = [lead for lead in leads if lead.status == LeadStatus.proposal]
    if proposal_leads:
        items.append(
            GrowRevenueItem(
                title="Воронка теряет клиентов на этапе КП",
                detail="Сократите время ответа и добавьте автоматические напоминания.",
                lead_ids=[lead.id for lead in proposal_leads[:25]],
            )
        )
    if follow_up:
        items.append(
            GrowRevenueItem(
                title=f"Свяжитесь с {len(follow_up)} лидами в ближайшие 24 часа",
                detail="Эти лиды нужно дожать, пока интерес не остыл.",
                lead_ids=[lead.id for lead in follow_up[:25]],
            )
        )

    return GrowRevenuePlan(potential_revenue=potential, currency="USD", items=items)
