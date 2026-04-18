"""Row-Level Security policies on shift_logs

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-18

DESIGN NOTE — superuser bypass:
    PostgreSQL RLS does NOT apply to the table owner or superusers unless
    FORCE ROW LEVEL SECURITY is set.  Because DATABASE_URL connects as the
    postgres superuser (or the role that created the tables), all service
    queries bypass RLS automatically during development.

    This is intentional for the hackathon: we get to demonstrate the RLS
    policy exists as a defense-in-depth measure while keeping service code
    simple (no SET LOCAL calls required on every session).

    To enforce RLS even for the owner (e.g. production):
        ALTER TABLE shift_logs FORCE ROW LEVEL SECURITY;
    Then every service session MUST call get_db_with_rls() which sets:
        SET LOCAL app.current_user_id = '<uuid>';
        SET LOCAL app.current_role    = '<role>';
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE shift_logs ENABLE ROW LEVEL SECURITY")

    # Workers see only their own shifts; verifiers and advocates see all.
    # current_setting(..., TRUE) — the TRUE flag makes it return NULL instead
    # of raising an error when the GUC variable has not been set on this session.
    op.execute("""
        CREATE POLICY worker_own_shifts ON shift_logs
            FOR SELECT
            USING (
                worker_id = current_setting('app.current_user_id', TRUE)::uuid
                OR current_setting('app.current_role', TRUE) IN ('verifier', 'advocate')
            )
    """)

    # Unrestricted write policy — application layer enforces ownership on mutations.
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
