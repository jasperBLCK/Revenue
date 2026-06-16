from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.events import events
from app.models.lead import Lead as LeadModel
from app.models.message import Message as MessageModel
from app.models.message import MessageDirection
from app.models.topic import Topic as TopicModel
from app.schemas.lead import Lead as LeadSchema
from app.services.leads import refresh_lead_insights
from app.services.scoring import bucket_for_lead
from app.services.telegram import telegram_service

router = APIRouter(prefix="/telegram", tags=["Telegram"])


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def telegram_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_telegram_bot_api_secret_token: str | None = Header(default=None),
) -> dict[str, bool]:
    # Validate Telegram secret token if configured.
    if settings.telegram_webhook_secret and (
        x_telegram_bot_api_secret_token != settings.telegram_webhook_secret
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad secret token")

    update: dict[str, Any] = await request.json()
    message = update.get("message") or update.get("edited_message")
    if not message:
        return {"ok": True}

    text = message.get("text", "")
    chat = message.get("chat", {})
    from_user = message.get("from", {})

    # Only handle direct messages from clients (private chats) here.
    if chat.get("type") != "private":
        return {"ok": True}

    telegram_user_id = from_user.get("id")
    if telegram_user_id is None:
        return {"ok": True}

    # Find or create the lead for this Telegram user.
    async def _fetch_lead() -> LeadModel | None:
        res = await db.execute(
            select(LeadModel)
            .options(selectinload(LeadModel.topic))
            .where(LeadModel.telegram_user_id == telegram_user_id)
        )
        return res.scalar_one_or_none()

    lead = await _fetch_lead()
    topic = lead.topic if lead is not None else None
    is_new_lead = lead is None
    if lead is None:
        name = " ".join(
            filter(None, [from_user.get("first_name"), from_user.get("last_name")])
        ) or from_user.get("username") or f"Lead {telegram_user_id}"
        lead = LeadModel(
            name=name,
            telegram_user_id=telegram_user_id,
            telegram_username=from_user.get("username"),
            last_activity_at=datetime.now(UTC),
        )
        db.add(lead)
        try:
            # Savepoint so a concurrent insert (unique index) doesn't poison the txn.
            async with db.begin_nested():
                await db.flush()
        except IntegrityError:
            # Another webhook delivery created this lead first; reuse it.
            lead = await _fetch_lead()
            assert lead is not None
            topic = lead.topic
            is_new_lead = False
        else:
            # Create a forum topic in the managers' group for this lead.
            thread_id = await telegram_service.create_forum_topic(name)
            if thread_id is None:
                thread_id = abs(hash(str(lead.id))) % 1_000_000
            topic = TopicModel(
                lead_id=lead.id,
                telegram_chat_id=settings.telegram_group_chat_id or 0,
                message_thread_id=thread_id,
                title=name,
                is_open=True,
            )
            db.add(topic)
            lead.topic = topic
            await db.flush()

    db.add(
        MessageModel(
            lead_id=lead.id,
            direction=MessageDirection.inbound,
            text=text,
            telegram_message_id=message.get("message_id"),
        )
    )
    lead.last_activity_at = datetime.now(UTC)
    await db.flush()

    # Mirror the client's message into the manager topic.
    if topic and text:
        await telegram_service.send_to_topic(
            topic.message_thread_id, f"{lead.name}: {text}"
        )

    await refresh_lead_insights(db, lead)
    await db.refresh(lead, attribute_names=["topic"])
    schema = LeadSchema.from_model(lead)
    # Commit before broadcasting so live subscribers that refetch see the row.
    await db.commit()
    await events.broadcast(
        {
            "type": "lead.created" if is_new_lead else "lead.updated",
            "source": "telegram",
            "bucket": bucket_for_lead(lead),
            "text": text,
            "lead": jsonable_encoder(schema),
        }
    )
    return {"ok": True}
