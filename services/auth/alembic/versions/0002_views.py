"""Views — zone_earnings_summary (regular) and monthly_worker_totals (materialized)

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-18
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Regular view — k-anonymity enforced via HAVING COUNT(DISTINCT worker_id) >= 5
    op.execute("""
        CREATE VIEW zone_earnings_summary AS
        SELECT
            u.city_zone_id,
            cz.name                                                         AS zone_name,
            sl.platform_id,
            p.name                                                          AS platform_name,
            DATE_TRUNC('week', sl.shift_date)                               AS week,
            COUNT(*)                                                        AS total_shifts,
            COUNT(DISTINCT sl.worker_id)                                    AS worker_count,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sl.net_received)    AS median_net,
            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY sl.net_received)   AS p25_net,
            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY sl.net_received)   AS p75_net,
            AVG(sl.net_received)                                            AS avg_net,
            AVG(sl.platform_deductions / NULLIF(sl.gross_earned, 0)) * 100  AS avg_commission_rate,
            AVG(sl.net_received / NULLIF(sl.hours_worked, 0))               AS avg_hourly_rate
        FROM shift_logs sl
        JOIN users u ON sl.worker_id = u.id
        JOIN city_zones cz ON u.city_zone_id = cz.id
        JOIN platforms p ON sl.platform_id = p.id
        WHERE sl.verification_status = 'verified'
        GROUP BY
            u.city_zone_id,
            cz.name,
            sl.platform_id,
            p.name,
            DATE_TRUNC('week', sl.shift_date)
        HAVING COUNT(DISTINCT sl.worker_id) >= 5
    """)

    # Materialized view — pre-computed monthly totals for MoM vulnerability detection
    op.execute("""
        CREATE MATERIALIZED VIEW monthly_worker_totals AS
        SELECT
            worker_id,
            DATE_TRUNC('month', shift_date)                                         AS month,
            SUM(net_received)                                                       AS total_net,
            SUM(gross_earned)                                                       AS total_gross,
            SUM(hours_worked)                                                       AS total_hours,
            COUNT(*)                                                                AS shift_count,
            AVG(platform_deductions / NULLIF(gross_earned, 0)) * 100               AS avg_commission_rate
        FROM shift_logs
        GROUP BY worker_id, DATE_TRUNC('month', shift_date)
    """)

    # Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
    op.execute(
        "CREATE UNIQUE INDEX idx_monthly_worker "
        "ON monthly_worker_totals(worker_id, month)"
    )


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS monthly_worker_totals")
    op.execute("DROP VIEW IF EXISTS zone_earnings_summary")
