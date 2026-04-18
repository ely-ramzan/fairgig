from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/commission-trends")
async def commission_trends(
    months: int = Query(3, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_role("advocate")),
):
    query = text("""
        SELECT
            platform_name,
            week,
            ROUND(avg_commission_rate::numeric, 2) AS avg_commission_rate,
            worker_count,
            total_shifts
        FROM zone_earnings_summary
        WHERE week >= NOW() - INTERVAL '1 month' * :months
        GROUP BY platform_name, week, avg_commission_rate, worker_count, total_shifts
        ORDER BY week, platform_name
    """)
    result = await db.execute(query, {"months": months})
    return [dict(row._mapping) for row in result.fetchall()]
