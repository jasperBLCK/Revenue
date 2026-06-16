import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_manager
from app.core.database import get_db
from app.models.funnel import Funnel as FunnelModel
from app.models.lead import Lead as LeadModel
from app.models.manager import Manager
from app.schemas.funnel import (
    Funnel as FunnelSchema,
)
from app.schemas.funnel import (
    FunnelAnalytics,
    FunnelAnalyticsStage,
    FunnelCreate,
    GeneratedFunnel,
    GenerateFunnelRequest,
)
from app.services.ai import ai_service

router = APIRouter(prefix="/funnels", tags=["Funnels"])


@router.get("", response_model=list[FunnelSchema])
async def list_funnels(
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> list[FunnelSchema]:
    result = await db.execute(select(FunnelModel).order_by(FunnelModel.created_at.desc()))
    return [FunnelSchema.model_validate(f) for f in result.scalars().all()]


@router.post("", response_model=FunnelSchema, status_code=status.HTTP_201_CREATED)
async def create_funnel(
    payload: FunnelCreate,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> FunnelSchema:
    funnel = FunnelModel(
        name=payload.name,
        business_type=payload.business_type,
        stages=[s.model_dump() for s in payload.stages],
    )
    db.add(funnel)
    await db.flush()
    await db.refresh(funnel)
    return FunnelSchema.model_validate(funnel)


@router.post("/generate", response_model=GeneratedFunnel)
async def generate_funnel(
    payload: GenerateFunnelRequest,
    _: Manager = Depends(get_current_manager),
) -> GeneratedFunnel:
    data = await ai_service.generate_funnel(payload.business_description)
    return GeneratedFunnel(**data)


@router.get("/{funnel_id}/analytics", response_model=FunnelAnalytics)
async def funnel_analytics(
    funnel_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> FunnelAnalytics:
    funnel = await db.get(FunnelModel, funnel_id)
    if funnel is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Funnel not found")

    # Count leads per funnel stage (by funnel_stage field) for conversion.
    rows = await db.execute(
        select(LeadModel.funnel_stage, func.count())
        .group_by(LeadModel.funnel_stage)
    )
    counts = {stage: count for stage, count in rows.all()}

    ordered = sorted(funnel.stages, key=lambda s: s.get("order", 0))
    stages: list[FunnelAnalyticsStage] = []
    first_count = None
    for stage in ordered:
        name = stage["name"]
        count = counts.get(name, 0)
        if first_count is None:
            first_count = count or 1
        conversion = round(count / first_count, 4) if first_count else 0.0
        stages.append(
            FunnelAnalyticsStage(name=name, count=count, conversion_rate=conversion)
        )

    # Find the largest drop-off between consecutive stages.
    insight = "Недостаточно данных для анализа воронки."
    worst_drop, worst_stage = 0.0, None
    for prev, cur in zip(stages, stages[1:], strict=False):
        if prev.count > 0:
            drop = (prev.count - cur.count) / prev.count
            if drop > worst_drop:
                worst_drop, worst_stage = drop, cur.name
    if worst_stage:
        insight = (
            f"Вы теряете {worst_drop:.0%} клиентов на переходе к этапу «{worst_stage}». "
            "Сократите время ответа и добавьте автоматические напоминания."
        )

    return FunnelAnalytics(funnel_id=funnel.id, stages=stages, ai_insight=insight)
