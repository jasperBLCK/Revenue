import enum
import uuid
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, ForeignKey, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.lead import Lead


class MessageDirection(str, enum.Enum):
    inbound = "inbound"  # client -> bot
    outbound = "outbound"  # manager -> bot -> client


class Message(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "messages"

    lead_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    direction: Mapped[MessageDirection] = mapped_column(
        SAEnum(MessageDirection, name="message_direction"), nullable=False
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    sender_manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("managers.id", ondelete="SET NULL"),
        nullable=True,
    )
    telegram_message_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    lead: Mapped["Lead"] = relationship(back_populates="messages")
