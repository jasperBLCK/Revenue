from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_manager
from app.core.database import get_db
from app.models.lead import Lead as LeadModel
from app.models.manager import Manager
from app.schemas.dashboard import DashboardSummary
from app.services.scoring import DEAL_VALUE_USD, bucket_for_lead

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
) -> DashboardSummary:
    result = await db.execute(select(LeadModel))
    leads = list(result.scalars().all())

    buckets = [bucket_for_lead(lead) for lead in leads]
    hot = buckets.count("hot")
    at_risk = buckets.count("at_risk")
    ghost = buckets.count("ghost")
    follow_up = buckets.count("follow_up")

    potential = round(DEAL_VALUE_USD * (hot + 0.5 * at_risk + 0.3 * ghost), 2)

    insight = (
        f"{hot} лидов готовы купить, {at_risk} могут уйти, {ghost} давно без ответа. "
        f"Потенциальная выручка: ${potential:,.0f}."
    )
    if hot == 0 and ghost == 0:
        insight = "База в порядке: критичных рисков и горячих лидов сейчас нет."

    return DashboardSummary(
        hot_count=hot,
        at_risk_count=at_risk,
        ghost_count=ghost,
        follow_up_24h_count=follow_up,
        potential_revenue=potential,
        currency="USD",
        revenue_insight=insight,
    )
