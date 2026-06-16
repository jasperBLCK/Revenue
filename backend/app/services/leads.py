"""Lead-level helpers: persist AI insights and load message history."""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lead import Lead
from app.models.message import Message
from app.services.ai import ai_service


async def load_messages(db: AsyncSession, lead_id) -> list[Message]:
    result = await db.execute(
        select(Message).where(Message.lead_id == lead_id).order_by(Message.created_at)
    )
    return list(result.scalars().all())


async def refresh_lead_insights(db: AsyncSession, lead: Lead) -> Lead:
    """Recompute and persist cached score + summary on the lead."""
    messages = await load_messages(db, lead.id)
    now = datetime.now(UTC)

    score = ai_service.score(lead, messages)
    lead.ai_purchase_probability = score["purchase_probability"]
    lead.ai_churn_risk = score["churn_risk"]
    lead.ai_interest_level = score["interest_level"]
    lead.ai_reasons = score["reasons"]
    lead.ai_score_updated_at = now

    summary = ai_service.summary(lead, messages)
    lead.ai_summary_bullets = summary["bullets"]
    lead.ai_sentiment = summary["sentiment"]
    lead.ai_summary_updated_at = now

    await db.flush()
    return lead
