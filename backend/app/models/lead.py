import enum
import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, DateTime, Float, ForeignKey, Index, String, Text, text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.message import Message
    from app.models.topic import Topic


class LeadStatus(str, enum.Enum):
    new = "new"
    contacted = "contacted"
    qualified = "qualified"
    proposal = "proposal"
    negotiation = "negotiation"
    won = "won"
    lost = "lost"


class Sentiment(str, enum.Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"


class Lead(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "leads"
    __table_args__ = (
        # One lead per Telegram user; allows many NULLs (web-created leads).
        Index(
            "uq_leads_telegram_user_id",
            "telegram_user_id",
            unique=True,
            postgresql_where=text("telegram_user_id IS NOT NULL"),
        ),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    telegram_user_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    telegram_username: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[LeadStatus] = mapped_column(
        SAEnum(LeadStatus, name="lead_status"),
        default=LeadStatus.new,
        nullable=False,
        index=True,
    )
    funnel_stage: Mapped[str | None] = mapped_column(String(255), nullable=True)
    assigned_manager_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("managers.id", ondelete="SET NULL"),
        nullable=True,
    )
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_activity_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Cached AI score (recomputed on each message)
    ai_purchase_probability: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ai_churn_risk: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ai_interest_level: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    ai_reasons: Mapped[list[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    ai_score_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Cached AI summary
    ai_summary_bullets: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, nullable=False
    )
    ai_sentiment: Mapped[Sentiment | None] = mapped_column(
        SAEnum(Sentiment, name="sentiment"), nullable=True
    )
    ai_summary_updated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    messages: Mapped[list["Message"]] = relationship(
        back_populates="lead", cascade="all, delete-orphan", order_by="Message.created_at"
    )
    topic: Mapped["Topic | None"] = relationship(
        back_populates="lead", uselist=False, cascade="all, delete-orphan"
    )
