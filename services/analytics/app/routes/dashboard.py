from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/dashboard-summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_role("advocate")),
):
    # Queries MUST run sequentially — an AsyncSession shares a single
    # connection and rejects concurrent operations (sqlalche.me/e/20/isce).
    # asyncio.gather on the same session raises InvalidRequestError:
    # "This session is provisioning a new connection; concurrent operations
    # are not permitted".
    active_workers = (
        await db.execute(
            text(
                "SELECT COUNT(DISTINCT worker_id) FROM shift_logs "
                "WHERE shift_date >= NOW() - INTERVAL '30 days'"
            )
        )
    ).scalar() or 0

    shift_row = (
        await db.execute(
            text(
                "SELECT COUNT(*) AS total, "
                "COUNT(*) FILTER (WHERE verification_status='verified') AS verified, "
                "COUNT(*) FILTER (WHERE verification_status='disputed') AS disputed "
                "FROM shift_logs"
            )
        )
    ).fetchone()
    total_shifts = shift_row[0] if shift_row else 0
    total_verified = shift_row[1] if shift_row else 0
    total_disputes = shift_row[2] if shift_row else 0

    avg_commission = float(
        (
            await db.execute(
                text(
                    "SELECT AVG(platform_deductions / NULLIF(gross_earned, 0)) * 100 "
                    "FROM shift_logs"
                )
            )
        ).scalar()
        or 0
    )

    vulnerable_count = int(
        (
            await db.execute(
                text(
                    """
                    WITH m AS (
                        SELECT worker_id, month, total_net,
                            LAG(total_net) OVER (PARTITION BY worker_id ORDER BY month) AS prev
                        FROM monthly_worker_totals
                    )
                    SELECT COUNT(*) FROM m
                    WHERE prev IS NOT NULL AND prev > 0
                      AND (prev - total_net) / prev > 0.20
                      AND month = (SELECT MAX(month) FROM monthly_worker_totals)
                    """
                )
            )
        ).scalar()
        or 0
    )

    open_grievances = int(
        (
            await db.execute(
                text(
                    "SELECT COUNT(*) FROM grievances "
                    "WHERE status IN ('open','escalated')"
                )
            )
        ).scalar()
        or 0
    )

    top_category_row = (
        await db.execute(
            text(
                "SELECT category FROM grievances "
                "GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1"
            )
        )
    ).fetchone()
    top_category = top_category_row[0] if top_category_row else None

    platform_count = int(
        (await db.execute(text("SELECT COUNT(*) FROM platforms"))).scalar() or 0
    )

    return {
        "total_active_workers": active_workers,
        "total_shifts_logged": total_shifts,
        "total_verified": total_verified,
        "total_disputes": total_disputes,
        "avg_commission_rate": round(avg_commission, 2),
        "vulnerable_workers_count": vulnerable_count,
        "open_grievances": open_grievances,
        "top_complaint_category": top_category,
        "platforms_tracked": platform_count,
    }
