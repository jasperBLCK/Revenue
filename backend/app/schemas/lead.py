import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.lead import LeadStatus
from app.schemas.ai import AiScore


class LeadBase(BaseModel):
    name: str
    telegram_user_id: int | None = None
    telegram_username: str | None = None


class LeadCreate(LeadBase):
    status: LeadStatus = LeadStatus.new


class LeadUpdate(BaseModel):
    name: str | None = None
    status: LeadStatus | None = None
    funnel_stage: str | None = None
    tags: list[str] | None = None
    notes: str | None = None


class Lead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    telegram_user_id: int | None = None
    telegram_username: str | None = None
    status: LeadStatus
    funnel_stage: str | None = None
    assigned_manager_id: uuid.UUID | None = None
    topic_id: uuid.UUID | None = None
    ai_score: AiScore
    tags: list[str] = []
    notes: str | None = None
    last_activity_at: datetime | None = None
    created_at: datetime

    @classmethod
    def from_model(cls, lead) -> "Lead":
        return cls(
            id=lead.id,
            name=lead.name,
            telegram_user_id=lead.telegram_user_id,
            telegram_username=lead.telegram_username,
            status=lead.status,
            funnel_stage=lead.funnel_stage,
            assigned_manager_id=lead.assigned_manager_id,
            topic_id=lead.topic.id if lead.topic else None,
            ai_score=AiScore(
                purchase_probability=lead.ai_purchase_probability,
                churn_risk=lead.ai_churn_risk,
                interest_level=lead.ai_interest_level,
                reasons=lead.ai_reasons,
                updated_at=lead.ai_score_updated_at,
            ),
            tags=lead.tags,
            notes=lead.notes,
            last_activity_at=lead.last_activity_at,
            created_at=lead.created_at,
        )


class LeadPage(BaseModel):
    items: list[Lead]
    page: int
    page_size: int
    total: int


class AssignRequest(BaseModel):
    manager_id: uuid.UUID


class AssistantResponse(BaseModel):
    answer: str
    related_leads: list[Lead] = []
