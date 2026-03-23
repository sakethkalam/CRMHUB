"""Extend opportunities table with probability, forecast_category, close_reason, stage_changed_at

Revision ID: 001_extend_opportunities
Revises:
Create Date: 2026-03-23
"""
from alembic import op
import sqlalchemy as sa

revision = "001_extend_opportunities"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "opportunities",
        sa.Column("probability", sa.Integer(), nullable=False, server_default="10"),
    )
    op.add_column(
        "opportunities",
        sa.Column(
            "forecast_category",
            sa.String(50),
            nullable=False,
            server_default="Pipeline",
        ),
    )
    op.add_column(
        "opportunities",
        sa.Column("close_reason", sa.String(255), nullable=True),
    )
    op.add_column(
        "opportunities",
        sa.Column("stage_changed_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Back-fill probability for existing rows based on their current stage
    op.execute("""
        UPDATE opportunities SET probability = CASE stage
            WHEN 'Prospecting'   THEN 10
            WHEN 'Qualification' THEN 20
            WHEN 'Proposal'      THEN 50
            WHEN 'Negotiation'   THEN 75
            WHEN 'Closed Won'    THEN 100
            WHEN 'Closed Lost'   THEN 0
            ELSE 10
        END
    """)


def downgrade() -> None:
    op.drop_column("opportunities", "stage_changed_at")
    op.drop_column("opportunities", "close_reason")
    op.drop_column("opportunities", "forecast_category")
    op.drop_column("opportunities", "probability")
