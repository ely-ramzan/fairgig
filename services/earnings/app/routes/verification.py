from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import uuid

from app.database import get_db
from app.dependencies import require_role
from app.models import ShiftLog, Verification, Platform, User
from app.schemas.earnings import VerifyRequest
from app.services.verification_service import can_transition

router = APIRouter(prefix="/api/earnings", tags=["verification"])


def _shift_dict(s, platform_name: str | None = None, worker_name: str | None = None) -> dict:
    return {
        "id": str(s.id),
        "worker_id": str(s.worker_id),
        "worker_name": worker_name,
        "platform_id": str(s.platform_id),
        "platform_name": platform_name,
        "shift_date": str(s.shift_date),
        "hours_worked": float(s.hours_worked),
        "gross_earned": float(s.gross_earned),
        "platform_deductions": float(s.platform_deductions),
        "net_received": float(s.net_received),
        "verification_status": s.verification_status,
        "import_source": s.import_source,
        "created_at": str(s.created_at) if s.created_at else None,
    }


@router.get("/verification-queue")
async def verification_queue(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(require_role("verifier")),
):
    stmt = (
        select(ShiftLog, Platform.name.label("platform_name"), User.display_name.label("worker_name"))
        .join(Platform, ShiftLog.platform_id == Platform.id, isouter=True)
        .join(User, ShiftLog.worker_id == User.id, isouter=True)
        .where(ShiftLog.verification_status == "pending")
        .order_by(ShiftLog.created_at.asc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    total_r = await db.execute(
        select(func.count(ShiftLog.id)).where(ShiftLog.verification_status == "pending")
    )
    total = total_r.scalar()

    return {
        "items": [_shift_dict(s, pname, wname) for s, pname, wname in rows],
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
        # UPDATE — preserve the row ID so no foreign-key references break
        old.status = body.status
        old.notes = body.notes
        old.verifier_gross = body.verifier_gross
        old.verifier_deductions = body.verifier_deductions
        old.verifier_id = uuid.UUID(user["user_id"])
    else:
        db.add(Verification(
            id=uuid.uuid4(),
            shift_log_id=shift_id,
            verifier_id=uuid.UUID(user["user_id"]),
            status=body.status,
            notes=body.notes,
            verifier_gross=body.verifier_gross,
            verifier_deductions=body.verifier_deductions,
        ))
    await db.commit()
    # Re-fetch platform name and worker name for the response
    plat_r = await db.execute(select(Platform).where(Platform.id == shift.platform_id))
    plat = plat_r.scalar_one_or_none()
    worker_r = await db.execute(select(User).where(User.id == shift.worker_id))
    worker = worker_r.scalar_one_or_none()
    return _shift_dict(shift, plat.name if plat else None, worker.display_name if worker else None)
