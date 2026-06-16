import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_manager
from app.core.database import get_db
from app.models.lead import Lead as LeadModel
from app.models.manager import Manager
from app.models.message import Message as MessageModel
from app.models.message import MessageDirection
from app.schemas.message import (
    Message as MessageSchema,
)
from app.schemas.message import (
    MessagePage,
    OutboundMessage,
)
from app.services.leads import refresh_lead_insights
from app.services.telegram import telegram_service

router = APIRouter(tags=["Messages"])


async def _get_lead_or_404(db: AsyncSession, lead_id: uuid.UUID) -> LeadModel:
    result = await db.execute(
        select(LeadModel).options(selectinload(LeadModel.topic)).where(LeadModel.id == lead_id)
    )
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.get("/leads/{lead_id}/messages", response_model=MessagePage)
async def list_messages(
    lead_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> MessagePage:
    await _get_lead_or_404(db, lead_id)
    total = await db.scalar(
        select(func.count()).select_from(MessageModel).where(MessageModel.lead_id == lead_id)
    )
    result = await db.execute(
        select(MessageModel)
        .where(MessageModel.lead_id == lead_id)
        .order_by(MessageModel.created_at)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = [MessageSchema.model_validate(m) for m in result.scalars().all()]
    return MessagePage(items=items, page=page, page_size=page_size, total=total or 0)


@router.post(
    "/leads/{lead_id}/messages",
    response_model=MessageSchema,
    status_code=status.HTTP_201_CREATED,
)
async def send_message(
    lead_id: uuid.UUID,
    payload: OutboundMessage,
    db: AsyncSession = Depends(get_db),
    manager: Manager = Depends(get_current_manager),
) -> MessageSchema:
    lead = await _get_lead_or_404(db, lead_id)

    # Deliver via Telegram (no-op if bot not configured).
    telegram_message_id = None
    if lead.telegram_user_id:
        telegram_message_id = await telegram_service.send_to_client(
            lead.telegram_user_id, payload.text
        )
    if lead.topic:
        await telegram_service.send_to_topic(lead.topic.message_thread_id, payload.text)

    message = MessageModel(
        lead_id=lead.id,
        direction=MessageDirection.outbound,
        text=payload.text,
        sender_manager_id=manager.id,
        telegram_message_id=telegram_message_id,
        is_ai_generated=payload.is_ai_generated,
    )
    db.add(message)
    lead.last_activity_at = datetime.now(UTC)
    await db.flush()
    await refresh_lead_insights(db, lead)
    await db.refresh(message)
    return MessageSchema.model_validate(message)
