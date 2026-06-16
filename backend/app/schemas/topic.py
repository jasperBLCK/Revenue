import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class Topic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    lead_id: uuid.UUID
    telegram_chat_id: int
    message_thread_id: int
    title: str
    is_open: bool
    created_at: datetime
