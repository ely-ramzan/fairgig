from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid

from app.database import get_db
from app.dependencies import require_role
from app.models import ShiftLog, Verification
from app.schemas.earnings import VerifyRequest
from app.services.verification_service import can_transition

router = APIRouter(prefix="/api/earnings", tags=["verification"])


def _shift_dict(s) -> dict:
    return {
        "id": str(s.id),
        "worker_id": str(s.worker_id),
        "platform_id": str(s.platform_id),
        "shift_date": str(s.shift_date),
        "hours_worked": float(s.hours_worked),
        "gross_earned": float(s.gross_earned),
        "platform_deductions": float(s.platform_deductions),
        "net_received": float(s.net_received),
        "verification_status": s.verification_status,
        "import_source": s.import_source,
    }


@router.get("/verification-queue")
async def verification_queue(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_role("verifier")),
):
    stmt = (
        select(ShiftLog)
        .where(ShiftLog.verification_status == "pending")
        .order_by(ShiftLog.created_at.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(stmt)
    shifts = result.scalars().all()

    total_r = await db.execute(
        select(func.count()).where(ShiftLog.verification_status == "pending")
    )
    total = total_r.scalar()

    return {
        "items": [_shift_dict(s) for s in shifts],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


@router.post("/shifts/{shift_id}/verify")
async def verify_shift(
    shift_id: uuid.UUID,
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("verifier")),
):
    result = await db.execute(select(ShiftLog).where(ShiftLog.id == shift_id))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(404, "Shift not found")

    if not can_transition(shift.verification_status, body.status):
        raise HTTPException(
            409,
            f"Cannot transition from '{shift.verification_status}' to '{body.status}'",
        )

    shift.verification_status = body.status

    existing = await db.execute(
        select(Verification).where(Verification.shift_log_id == shift_id)
    )
    old = existing.scalar_one_or_none()
    if old:
        await db.delete(old)

    verification = Verification(
        id=uuid.uuid4(),
        shift_log_id=shift_id,
        verifier_id=uuid.UUID(user["user_id"]),
        status=body.status,
        notes=body.notes,
        verifier_gross=body.verifier_gross,
        verifier_deductions=body.verifier_deductions,
    )
    db.add(verification)
    await db.commit()
    return _shift_dict(shift)
