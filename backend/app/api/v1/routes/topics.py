import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_manager
from app.core.config import settings
from app.core.database import get_db
from app.models.lead import Lead as LeadModel
from app.models.manager import Manager
from app.models.topic import Topic as TopicModel
from app.schemas.topic import Topic as TopicSchema
from app.services.telegram import telegram_service

router = APIRouter(tags=["Topics"])


async def _get_lead_or_404(db: AsyncSession, lead_id: uuid.UUID) -> LeadModel:
    result = await db.execute(
        select(LeadModel).options(selectinload(LeadModel.topic)).where(LeadModel.id == lead_id)
    )
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.get("/leads/{lead_id}/topic", response_model=TopicSchema)
async def get_topic(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> TopicSchema:
    lead = await _get_lead_or_404(db, lead_id)
    if lead.topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return TopicSchema.model_validate(lead.topic)


@router.post(
    "/leads/{lead_id}/topic", response_model=TopicSchema, status_code=status.HTTP_201_CREATED
)
async def create_topic(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> TopicSchema:
    lead = await _get_lead_or_404(db, lead_id)
    if lead.topic is not None:
        lead.topic.is_open = True
        await db.flush()
        return TopicSchema.model_validate(lead.topic)

    title = f"{lead.name} ({lead.telegram_username or lead.telegram_user_id or 'lead'})"
    thread_id = await telegram_service.create_forum_topic(title)
    if thread_id is None:
        # Local fallback id so the CRM remains usable without a live bot.
        thread_id = abs(hash(str(lead.id))) % 1_000_000

    topic = TopicModel(
        lead_id=lead.id,
        telegram_chat_id=settings.telegram_group_chat_id or 0,
        message_thread_id=thread_id,
        title=title,
        is_open=True,
    )
    db.add(topic)
    await db.flush()
    await db.refresh(topic)
    return TopicSchema.model_validate(topic)
