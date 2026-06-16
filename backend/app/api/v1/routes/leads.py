import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.encoders import jsonable_encoder
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_manager
from app.core.database import get_db
from app.core.events import events
from app.models.lead import Lead as LeadModel
from app.models.lead import LeadStatus
from app.models.manager import Manager
from app.schemas.lead import (
    AssignRequest,
    LeadCreate,
    LeadPage,
    LeadUpdate,
)
from app.schemas.lead import (
    Lead as LeadSchema,
)
from app.services.leads import refresh_lead_insights
from app.services.scoring import bucket_for_lead

router = APIRouter(prefix="/leads", tags=["Leads"])

_SORT_MAP = {
    "score_desc": LeadModel.ai_purchase_probability.desc(),
    "score_asc": LeadModel.ai_purchase_probability.asc(),
    "last_activity_desc": LeadModel.last_activity_at.desc().nullslast(),
    "created_desc": LeadModel.created_at.desc(),
}


async def _get_lead_or_404(db: AsyncSession, lead_id: uuid.UUID) -> LeadModel:
    result = await db.execute(
        select(LeadModel).options(selectinload(LeadModel.topic)).where(LeadModel.id == lead_id)
    )
    lead = result.scalar_one_or_none()
    if lead is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lead not found")
    return lead


@router.get("", response_model=LeadPage)
async def list_leads(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: LeadStatus | None = Query(None, alias="status"),
    bucket: str | None = Query(None, pattern="^(hot|at_risk|ghost|follow_up)$"),
    search: str | None = None,
    sort: str = Query("last_activity_desc"),
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> LeadPage:
    stmt = select(LeadModel).options(selectinload(LeadModel.topic))
    if status_filter is not None:
        stmt = stmt.where(LeadModel.status == status_filter)
    if search:
        like = f"%{search}%"
        stmt = stmt.where(
            or_(LeadModel.name.ilike(like), LeadModel.telegram_username.ilike(like))
        )

    stmt = stmt.order_by(_SORT_MAP.get(sort, _SORT_MAP["last_activity_desc"]))
    result = await db.execute(stmt)
    leads = list(result.scalars().all())

    # Anti-Ghost bucket filtering is derived from cached AI fields.
    if bucket:
        leads = [lead for lead in leads if bucket_for_lead(lead) == bucket]

    total = len(leads)
    start = (page - 1) * page_size
    paged = leads[start : start + page_size]
    return LeadPage(
        items=[LeadSchema.from_model(lead) for lead in paged],
        page=page,
        page_size=page_size,
        total=total,
    )


@router.post("", response_model=LeadSchema, status_code=status.HTTP_201_CREATED)
async def create_lead(
    payload: LeadCreate,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> LeadSchema:
    lead = LeadModel(
        name=payload.name,
        telegram_user_id=payload.telegram_user_id,
        telegram_username=payload.telegram_username,
        status=payload.status,
        last_activity_at=datetime.now(UTC),
    )
    db.add(lead)
    await db.flush()
    await refresh_lead_insights(db, lead)
    await db.refresh(lead, attribute_names=["topic"])
    schema = LeadSchema.from_model(lead)
    # Commit before broadcasting so live subscribers that refetch see the row.
    await db.commit()
    await events.broadcast(
        {
            "type": "lead.created",
            "source": "web",
            "bucket": bucket_for_lead(lead),
            "lead": jsonable_encoder(schema),
        }
    )
    return schema


@router.get("/{lead_id}", response_model=LeadSchema)
async def get_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> LeadSchema:
    lead = await _get_lead_or_404(db, lead_id)
    return LeadSchema.from_model(lead)


@router.patch("/{lead_id}", response_model=LeadSchema)
async def update_lead(
    lead_id: uuid.UUID,
    payload: LeadUpdate,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> LeadSchema:
    lead = await _get_lead_or_404(db, lead_id)
    data = payload.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(lead, key, value)
    await db.flush()
    if "status" in data:
        await refresh_lead_insights(db, lead)
    return LeadSchema.from_model(lead)


@router.delete("/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(
    lead_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> None:
    lead = await _get_lead_or_404(db, lead_id)
    await db.delete(lead)


@router.post("/{lead_id}/assign", response_model=LeadSchema)
async def assign_lead(
    lead_id: uuid.UUID,
    payload: AssignRequest,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> LeadSchema:
    lead = await _get_lead_or_404(db, lead_id)
    manager = await db.get(Manager, payload.manager_id)
    if manager is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")
    lead.assigned_manager_id = payload.manager_id
    await db.flush()
    return LeadSchema.from_model(lead)
