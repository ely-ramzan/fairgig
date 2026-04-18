import asyncio
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
    async def _active_workers():
        r = await db.execute(text(
            "SELECT COUNT(DISTINCT worker_id) FROM shift_logs "
            "WHERE shift_date >= NOW() - INTERVAL '30 days'"
        ))
        return r.scalar()

    async def _shift_counts():
        r = await db.execute(text(
            "SELECT COUNT(*) as total, "
            "COUNT(*) FILTER (WHERE verification_status='verified') as verified, "
            "COUNT(*) FILTER (WHERE verification_status='disputed') as disputed "
            "FROM shift_logs"
        ))
        row = r.fetchone()
        return {"total": row[0], "verified": row[1], "disputed": row[2]}

    async def _avg_commission():
        r = await db.execute(text(
            "SELECT AVG(platform_deductions / NULLIF(gross_earned,0)) * 100 FROM shift_logs"
        ))
        return float(r.scalar() or 0)

    async def _vulnerable_count():
        r = await db.execute(text("""
            WITH m AS (
                SELECT worker_id, month, total_net,
                    LAG(total_net) OVER (PARTITION BY worker_id ORDER BY month) AS prev
                FROM monthly_worker_totals
            )
            SELECT COUNT(*) FROM m
            WHERE prev IS NOT NULL AND prev > 0 AND (prev - total_net)/prev > 0.20
              AND month = (SELECT MAX(month) FROM monthly_worker_totals)
        """))
        return int(r.scalar() or 0)

    async def _open_grievances():
        r = await db.execute(text(
            "SELECT COUNT(*) FROM grievances WHERE status IN ('open','escalated')"
        ))
        return int(r.scalar() or 0)

    async def _top_category():
        r = await db.execute(text(
            "SELECT category FROM grievances GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1"
        ))
        row = r.fetchone()
        return row[0] if row else None

    async def _platform_count():
        r = await db.execute(text("SELECT COUNT(*) FROM platforms"))
        return int(r.scalar())

    (
        active_workers, shift_counts, avg_commission,
        vulnerable_count, open_grievances, top_category, platform_count,
    ) = await asyncio.gather(
        _active_workers(), _shift_counts(), _avg_commission(),
        _vulnerable_count(), _open_grievances(), _top_category(), _platform_count(),
    )

    return {
        "total_active_workers": active_workers,
        "total_shifts_logged": shift_counts["total"],
        "total_verified": shift_counts["verified"],
        "total_disputes": shift_counts["disputed"],
        "avg_commission_rate": round(avg_commission, 2),
        "vulnerable_workers_count": vulnerable_count,
        "open_grievances": open_grievances,
        "top_complaint_category": top_category,
        "platforms_tracked": platform_count,
    }
