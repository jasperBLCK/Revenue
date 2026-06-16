from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.base import TimestampMixin, UUIDMixin


class Funnel(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "funnels"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    business_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # list of {"name": str, "order": int}
    stages: Mapped[list[dict]] = mapped_column(JSONB, default=list, nullable=False)
