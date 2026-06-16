import io
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_manager
from app.core.database import get_db
from app.models.lead import Lead as LeadModel
from app.models.lead import LeadStatus
from app.models.manager import Manager
from app.models.message import Message as MessageModel

router = APIRouter(prefix="/analytics", tags=["Analytics"])


@router.get("/export")
async def export_leads(
    format: str = Query("csv", pattern="^(csv)$"),
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
):
    """Export all leads to CSV."""
    result = await db.execute(select(LeadModel).order_by(LeadModel.created_at.desc()))
    leads = result.scalars().all()

    # Build CSV
    lines = [
        "ID,Name,Status,AI Score,Churn Risk,Stage,Tags,Messages Count,Last Activity,Created At"
    ]
    for lead in leads:
        msg_count = len(lead.messages) if lead.messages else 0
        tags = ";".join(lead.tags) if lead.tags else ""
        last_activity = (lead.last_activity_at or "").isoformat() if lead.last_activity_at else ""
        created = (lead.created_at or "").isoformat() if lead.created_at else ""
        lines.append(
            f'"{lead.id}","{lead.name}","{lead.status.value}",{lead.ai_purchase_probability:.2f},'
            f'{lead.ai_churn_risk:.2f},"{lead.funnel_stage or ""}","{tags}",{msg_count},"{last_activity}","{created}"'
        )

    csv_content = "\n".join(lines)
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads_export.csv"},
    )


@router.get("/leaderboard")
async def leaderboard(
    period_days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
):
    """Get team leaderboard: sales by manager."""
    since = datetime.now(UTC) - timedelta(days=period_days)

    # Get all managers with their won deals
    result = await db.execute(
        select(
            Manager.id,
            Manager.name,
            func.count(LeadModel.id).label("total_leads"),
            func.count(
                case_when(LeadModel.status == LeadStatus.won, 1)
            ).label("won_deals"),
        )
        .outerjoin(LeadModel, LeadModel.assigned_manager_id == Manager.id)
        .where(LeadModel.created_at >= since)
        .group_by(Manager.id, Manager.name)
        .order_by(desc("won_deals"))
    )

    rows = result.fetchall()
    return {
        "period_days": period_days,
        "leaderboard": [
            {
                "manager_id": str(row[0]),
                "name": row[1],
                "total_leads": row[2],
                "won_deals": row[3],
                "conversion_rate": (row[3] / row[2] * 100) if row[2] > 0 else 0,
            }
            for row in rows
        ],
    }


class EmailTemplate:
    """In-memory templates for now; can be moved to DB later."""

    TEMPLATES = {
        "follow_up_basic": {
            "name": "Follow-up (Basic)",
            "subject": "Re: Your inquiry",
            "body": "Hi {{name}},\n\nJust checking in to see if you had any questions about our proposal.\n\nBest regards",
        },
        "follow_up_value": {
            "name": "Follow-up (Value-focused)",
            "subject": "See how {{company}} can save time",
            "body": "Hi {{name}},\n\nI wanted to share how similar companies like {{company}} have saved 20+ hours/week using our solution.\n\nWould you be open to a quick demo?\n\nBest regards",
        },
        "follow_up_discount": {
            "name": "Follow-up (Discount)",
            "subject": "Special offer for {{name}}",
            "body": "Hi {{name}},\n\nAs a thank you for your interest, we'd like to offer you a 20% discount if you decide to move forward this month.\n\nInterested?\n\nBest regards",
        },
        "reactivation": {
            "name": "Reactivation (Ghost)",
            "subject": "We missed you!",
            "body": "Hi {{name}},\n\nIt's been a while since we last connected. We've made some exciting updates that might be perfect for your needs.\n\nWould love to reconnect!\n\nBest regards",
        },
    }

    @classmethod
    def list(cls):
        return list(cls.TEMPLATES.values())

    @classmethod
    def get(cls, template_id: str):
        return cls.TEMPLATES.get(template_id)


@router.get("/templates")
async def list_templates(
    _: Manager = Depends(get_current_manager),
):
    """List all available email templates."""
    return {"templates": EmailTemplate.list()}


@router.post("/batch/update-status")
async def batch_update_status(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
):
    """Batch update lead status. Payload: {lead_ids: [], status: 'won'|'lost'|...}"""
    lead_ids = payload.get("lead_ids", [])
    new_status = payload.get("status")

    if not lead_ids or not new_status:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing fields")

    try:
        status_enum = LeadStatus(new_status)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")

    # Convert string IDs to UUIDs
    try:
        uuids = [uuid.UUID(id_str) for id_str in lead_ids]
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid lead IDs")

    result = await db.execute(
        select(LeadModel).where(LeadModel.id.in_(uuids))
    )
    leads = result.scalars().all()

    for lead in leads:
        lead.status = status_enum

    await db.commit()
    return {"updated": len(leads)}


@router.post("/batch/assign")
async def batch_assign(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
):
    """Batch assign leads to manager. Payload: {lead_ids: [], manager_id: '...'}"""
    lead_ids = payload.get("lead_ids", [])
    manager_id = payload.get("manager_id")

    if not lead_ids or not manager_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing fields")

    try:
        manager_uuid = uuid.UUID(manager_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid manager ID")

    manager = await db.get(Manager, manager_uuid)
    if not manager:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")

    try:
        uuids = [uuid.UUID(id_str) for id_str in lead_ids]
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid lead IDs")

    result = await db.execute(
        select(LeadModel).where(LeadModel.id.in_(uuids))
    )
    leads = result.scalars().all()

    for lead in leads:
        lead.assigned_manager_id = manager_uuid

    await db.commit()
    return {"updated": len(leads)}


@router.post("/automations")
async def create_automation(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    _: Manager = Depends(get_current_manager),
):
    """
    Create automation rule. Payload example:
    {
      "name": "Auto-follow-up for hot leads",
      "trigger": "score_above",
      "score_threshold": 80,
      "action": "tag",
      "action_value": "auto_contacted"
    }
    """
    name = payload.get("name")
    trigger = payload.get("trigger")
    score_threshold = payload.get("score_threshold", 75)
    action = payload.get("action")
    action_value = payload.get("action_value")

    if not all([name, trigger, action]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing fields")

    # For MVP, just store the config and apply manually in cron
    # Return a mock automation ID
    automation_id = str(uuid.uuid4())
    return {
        "id": automation_id,
        "name": name,
        "trigger": trigger,
        "score_threshold": score_threshold,
        "action": action,
        "action_value": action_value,
        "created_at": datetime.now(UTC).isoformat(),
        "status": "active",
    }


@router.get("/automations")
async def list_automations(
    _: Manager = Depends(get_current_manager),
):
    """List all automations (for now, mock data)."""
    return {
        "automations": [
            {
                "id": "auto-1",
                "name": "Auto-tag hot leads",
                "trigger": "score_above",
                "score_threshold": 80,
                "action": "tag",
                "action_value": "hot_lead",
                "status": "active",
                "created_at": "2026-06-15T10:00:00Z",
            },
            {
                "id": "auto-2",
                "name": "Notify on ghost leads",
                "trigger": "days_without_response",
                "days_threshold": 7,
                "action": "notify",
                "status": "active",
                "created_at": "2026-06-14T15:30:00Z",
            },
        ]
    }


def case_when(condition, value):
    """Simple helper for SQL CASE WHEN."""
    from sqlalchemy import case

    return case((condition, value), else_=0)
