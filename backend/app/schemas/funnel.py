import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FunnelStage(BaseModel):
    name: str
    order: int


class FunnelCreate(BaseModel):
    name: str
    business_type: str | None = None
    stages: list[FunnelStage]


class Funnel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    business_type: str | None = None
    stages: list[FunnelStage]
    created_at: datetime


class GenerateFunnelRequest(BaseModel):
    business_description: str


class GeneratedFunnel(BaseModel):
    stages: list[FunnelStage]
    explanation: str


class FunnelAnalyticsStage(BaseModel):
    name: str
    count: int
    conversion_rate: float


class FunnelAnalytics(BaseModel):
    funnel_id: uuid.UUID
    stages: list[FunnelAnalyticsStage]
    ai_insight: str
