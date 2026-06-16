"""unique partial index on leads.telegram_user_id

Revision ID: b1a2c3d4e5f6
Revises: 6e77334ec2bb
Create Date: 2026-06-16 00:55:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1a2c3d4e5f6"
down_revision: str | None = "6e77334ec2bb"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Replace the non-unique index with a unique partial index so a Telegram
    # user maps to at most one lead (NULLs, i.e. web leads, are unconstrained).
    op.drop_index(op.f("ix_leads_telegram_user_id"), table_name="leads")
    op.create_index(
        "uq_leads_telegram_user_id",
        "leads",
        ["telegram_user_id"],
        unique=True,
        postgresql_where=sa.text("telegram_user_id IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_leads_telegram_user_id", table_name="leads")
    op.create_index(
        op.f("ix_leads_telegram_user_id"), "leads", ["telegram_user_id"], unique=False
    )
