import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.lead import Sentiment


class AiScore(BaseModel):
    purchase_probability: float = Field(ge=0, le=1)
    churn_risk: float = Field(ge=0, le=1)
    interest_level: float = Field(ge=0, le=1)
    reasons: list[str] = []
    updated_at: datetime | None = None


class AiSummary(BaseModel):
    lead_id: uuid.UUID
    bullets: list[str] = []
    sentiment: Sentiment = Sentiment.neutral
    updated_at: datetime | None = None


class AiNextAction(BaseModel):
    action: str
    reason: str
    priority: str = Field(default="medium", pattern="^(low|medium|high)$")


class GenerateReplyRequest(BaseModel):
    tone: str = Field(
        default="friendly",
        pattern="^(friendly|confident|short|discount_focused|value_focused)$",
    )
    instruction: str | None = None


class GeneratedReply(BaseModel):
    text: str
    tone: str


class AssistantQuery(BaseModel):
    query: str


class GrowRevenueItem(BaseModel):
    title: str
    detail: str
    lead_ids: list[uuid.UUID] = []


class GrowRevenuePlan(BaseModel):
    potential_revenue: float
    currency: str = "USD"
    items: list[GrowRevenueItem] = []
