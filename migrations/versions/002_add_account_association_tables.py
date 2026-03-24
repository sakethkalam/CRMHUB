"""Add opportunity_accounts and lead_accounts many-to-many association tables

Revision ID: 002_add_account_association_tables
Revises: 001_extend_opportunities
Create Date: 2026-03-24
"""
from alembic import op
import sqlalchemy as sa

revision = "002_add_account_association_tables"
down_revision = "001_extend_opportunities"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "opportunity_accounts",
        sa.Column(
            "opportunity_id",
            sa.Integer(),
            sa.ForeignKey("opportunities.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )

    op.create_table(
        "lead_accounts",
        sa.Column(
            "lead_id",
            sa.Integer(),
            sa.ForeignKey("leads.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "account_id",
            sa.Integer(),
            sa.ForeignKey("accounts.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
    )

    # Back-fill opportunity_accounts from the existing single account_id column
    # so existing data is not lost when the UI switches to the new M2M relationship.
    op.execute("""
        INSERT INTO opportunity_accounts (opportunity_id, account_id)
        SELECT id, account_id
        FROM opportunities
        WHERE account_id IS NOT NULL
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table("lead_accounts")
    op.drop_table("opportunity_accounts")
