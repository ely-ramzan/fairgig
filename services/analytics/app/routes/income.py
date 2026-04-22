from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/income-distribution")
async def income_distribution(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_role("advocate")),
):
    query = text("""
        SELECT
            zone_name,
            ROUND(AVG(p25_net)::numeric, 2)    AS p25_net,
            ROUND(AVG(median_net)::numeric, 2)  AS p50_net,
            ROUND(AVG(p75_net)::numeric, 2)    AS p75_net,
            ROUND(AVG(avg_net)::numeric, 2)    AS avg_net,
            SUM(worker_count)                   AS worker_count
        FROM zone_earnings_summary
        WHERE week = (SELECT MAX(week) FROM zone_earnings_summary)
        GROUP BY zone_name
        ORDER BY zone_name
    """)
    result = await db.execute(query)
    return [dict(row._mapping) for row in result.fetchall()]
