from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.database import get_db
from app.dependencies import require_role
from app.queries.platform_comparison import PLATFORM_COMPARISON_QUERY

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/platform-comparison")
async def platform_comparison(
    months: int = Query(3, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_role("advocate")),
):
    result = await db.execute(text(PLATFORM_COMPARISON_QUERY), {"months": months})
    return [dict(row._mapping) for row in result.fetchall()]
