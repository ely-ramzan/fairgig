from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
import datetime

from app.database import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/api/analytics", tags=["admin"])

VIEWS = ["zone_earnings_summary", "monthly_worker_totals"]


@router.post("/refresh-views")
async def refresh_views(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_role("advocate")),
):
    """
    Manually triggers REFRESH MATERIALIZED VIEW CONCURRENTLY on both
    analytics views.  Safe to call at any time — CONCURRENTLY means reads
    are not blocked while the refresh runs.
    """
    refreshed = []
    for view in VIEWS:
        await db.execute(
            text(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}")
        )
        refreshed.append(view)

    # Commit so the refresh is visible immediately to the next request.
    await db.commit()

    return {
        "refreshed": refreshed,
        "refreshed_at": datetime.datetime.utcnow().isoformat() + "Z",
    }
