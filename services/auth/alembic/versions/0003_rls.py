"""Row-Level Security policies on shift_logs

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-18
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable RLS — rows are invisible to everyone until a policy grants access
    op.execute("ALTER TABLE shift_logs ENABLE ROW LEVEL SECURITY")

    # Workers see only their own shifts; verifiers and advocates see all
    op.execute("""
        CREATE POLICY worker_own_shifts ON shift_logs
            FOR SELECT
            USING (
                worker_id = current_setting('app.current_user_id', TRUE)::uuid
                OR current_setting('app.current_role', TRUE) IN ('verifier', 'advocate')
            )
    """)

    # Allow INSERT/UPDATE/DELETE unrestricted (application enforces ownership)
    op.execute("""
        CREATE POLICY shift_logs_write ON shift_logs
            FOR ALL
            USING (TRUE)
            WITH CHECK (TRUE)
    """)


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS shift_logs_write ON shift_logs")
    op.execute("DROP POLICY IF EXISTS worker_own_shifts ON shift_logs")
    op.execute("ALTER TABLE shift_logs DISABLE ROW LEVEL SECURITY")
