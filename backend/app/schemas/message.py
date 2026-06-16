import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.message import MessageDirection


class Message(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    direction: MessageDirection
    text: str
    sender_manager_id: uuid.UUID | None = None
    telegram_message_id: int | None = None
    is_ai_generated: bool = False
    created_at: datetime


class OutboundMessage(BaseModel):
    text: str
    is_ai_generated: bool = False


class MessagePage(BaseModel):
    items: list[Message]
    page: int
    page_size: int
    total: int
