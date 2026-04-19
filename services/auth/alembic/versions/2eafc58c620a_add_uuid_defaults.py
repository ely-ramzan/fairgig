"""add_uuid_defaults

Revision ID: 2eafc58c620a
Revises: 0003
Create Date: 2026-04-19 04:27:40.136453

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2eafc58c620a'
down_revision: Union[str, None] = '0003'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add UUID defaults to existing tables
    op.execute("ALTER TABLE grievances ALTER COLUMN id SET DEFAULT gen_random_uuid()")
    op.execute("ALTER TABLE grievance_tags ALTER COLUMN id SET DEFAULT gen_random_uuid()")
    op.execute("ALTER TABLE anomaly_results ALTER COLUMN id SET DEFAULT gen_random_uuid()")


def downgrade() -> None:
    pass
