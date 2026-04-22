from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from datetime import date, datetime
import uuid

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import ShiftLog, Platform, FileUpload, Screenshot
from app.schemas.earnings import ShiftCreate
from app.services.cloudinary_service import upload_raw_file
from app.services.import_service import parse_csv, parse_excel

router = APIRouter(prefix="/api/earnings", tags=["earnings"])


def _shift_dict(s, platform_name: str | None = None, has_screenshot: bool = False) -> dict:
    return {
        "id": str(s.id),
        "worker_id": str(s.worker_id),
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
        "has_screenshot": has_screenshot,
    }


# POST /api/earnings/shifts/import  ← registered before /:id to avoid path conflict
@router.post("/shifts/import", status_code=201)
async def import_shifts(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("worker")),
):
    filename = file.filename or "upload"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext not in ("csv", "xlsx", "xls"):
        raise HTTPException(422, f"Unsupported file type: {ext!r}. Use CSV or XLSX.")

    file_bytes = await file.read()

    # build platform_map: {lower_name: str(uuid)}
    result = await db.execute(select(Platform))
    platforms = result.scalars().all()
    platform_map = {p.name.lower(): str(p.id) for p in platforms}

    if ext == "csv":
        valid_rows, errors = parse_csv(file_bytes, platform_map, filename)
    else:
        valid_rows, errors = parse_excel(file_bytes, platform_map, filename)

    worker_uuid = uuid.UUID(user["user_id"])

    # Filter out rows that already exist in the DB to prevent double-imports.
    if valid_rows:
        existing_r = await db.execute(
            select(ShiftLog.shift_date, ShiftLog.platform_id)
            .where(ShiftLog.worker_id == worker_uuid)
        )
        existing_pairs = {
            (row.shift_date, row.platform_id) for row in existing_r.all()
        }
        deduped: list = []
        for row in valid_rows:
            key = (row["shift_date"], uuid.UUID(row["platform_id"]))
            if key in existing_pairs:
                errors.append({
                    "row": "—",
                    "reason": (
                        f"Duplicate: shift on {row['shift_date']} for this "
                        "platform already exists in your account"
                    ),
                })
            else:
                deduped.append(row)
        valid_rows = deduped

    # upload to Cloudinary
    upload_result = upload_raw_file(file_bytes, filename)

    # persist FileUpload record
    file_upload = FileUpload(
        id=uuid.uuid4(),
        worker_id=worker_uuid,
        cloudinary_public_id=upload_result["public_id"],
        cloudinary_url=upload_result["secure_url"],
        original_filename=filename,
        file_type=ext if ext in ("csv", "xlsx", "xls") else "csv",
        file_size_bytes=len(file_bytes),
        rows_imported=len(valid_rows),
        rows_skipped=0,
        rows_errored=len(errors),
        import_status="completed",
        error_summary={"errors": errors} if errors else None,
        uploaded_at=datetime.utcnow(),
        processed_at=datetime.utcnow(),
    )
    db.add(file_upload)
    await db.flush()

    for row in valid_rows:
        shift = ShiftLog(
            id=uuid.uuid4(),
            worker_id=worker_uuid,
            platform_id=uuid.UUID(row["platform_id"]),
            shift_date=row["shift_date"],
            hours_worked=row["hours_worked"],
            gross_earned=row["gross_earned"],
            platform_deductions=row["platform_deductions"],
            net_received=row["net_received"],
            verification_status="pending",
            import_source="csv",
            file_upload_id=file_upload.id,
        )
        db.add(shift)
        await db.flush()

    await db.commit()
    await db.refresh(file_upload)

    return {
        "upload_id": str(file_upload.id),
        "rows_imported": len(valid_rows),
        "rows_errored": len(errors),
        "errors": errors,
    }


# GET /api/earnings/imports
@router.get("/imports")
async def list_imports(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(FileUpload)
        .where(FileUpload.worker_id == uuid.UUID(user["user_id"]))
        .order_by(FileUpload.uploaded_at.desc())
    )
    uploads = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "original_filename": u.original_filename,
            "file_type": u.file_type,
            "rows_imported": u.rows_imported,
            "rows_errored": u.rows_errored,
            "import_status": u.import_status,
            "uploaded_at": str(u.uploaded_at),
        }
        for u in uploads
    ]


# POST /api/earnings/shifts
@router.post("/shifts", status_code=201)
async def create_shift(
    body: ShiftCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("worker")),
):
    shift = ShiftLog(
        id=uuid.uuid4(),                          # explicit — don't rely on DB default in tests
        worker_id=uuid.UUID(user["user_id"]),
        platform_id=uuid.UUID(body.platform_id),
        shift_date=body.shift_date,
        hours_worked=body.hours_worked,
        gross_earned=body.gross_earned,
        platform_deductions=body.platform_deductions,
        net_received=body.net_received,
        verification_status="pending",            # explicit — server_default not set in tests
        import_source="manual",
    )
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    plat_r = await db.execute(select(Platform).where(Platform.id == shift.platform_id))
    platform = plat_r.scalar_one_or_none()
    return _shift_dict(shift, platform.name if platform else None)


# GET /api/earnings/shifts  (paginated, own shifts only)
@router.get("/shifts")
async def list_shifts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    platform_id: str = None,
    status: str = None,
    date_from: date = None,
    date_to: date = None,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("worker")),
):
    worker_uuid = uuid.UUID(user["user_id"])
    # Build conditions once — reused for both count and data queries to
    # guarantee the pagination total always matches the returned rows.
    conditions = [ShiftLog.worker_id == worker_uuid]
    if platform_id:
        conditions.append(ShiftLog.platform_id == uuid.UUID(platform_id))
    if status:
        conditions.append(ShiftLog.verification_status == status)
    if date_from:
        conditions.append(ShiftLog.shift_date >= date_from)
    if date_to:
        conditions.append(ShiftLog.shift_date <= date_to)

    total_r = await db.execute(
        select(func.count(ShiftLog.id)).where(*conditions)
    )
    total = total_r.scalar()

    stmt = (
        select(
            ShiftLog,
            Platform.name.label("platform_name"),
            select(func.count(Screenshot.id))
            .where(Screenshot.shift_log_id == ShiftLog.id)
            .correlate(ShiftLog)
            .scalar_subquery()
            .label("screenshot_count"),
        )
        .join(Platform, ShiftLog.platform_id == Platform.id)
        .where(*conditions)
        .order_by(ShiftLog.shift_date.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return {
        "items": [_shift_dict(s, pname, bool(sc_count)) for s, pname, sc_count in rows],
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


# GET /api/earnings/platforms
@router.get("/platforms")
async def list_platforms(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Platform).order_by(Platform.name))
    return [
        {"id": str(p.id), "name": p.name, "category": p.category}
        for p in result.scalars().all()
    ]


# GET /api/earnings/worker/:id/shifts-raw  ← Anomaly Service calls this
@router.get("/worker/{worker_id}/shifts-raw")
async def get_worker_shifts_raw(
    worker_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    if _user["role"] == "worker" and _user["user_id"] != str(worker_id):
        raise HTTPException(403, "Cannot access another worker's shifts")
    stmt = (
        select(ShiftLog, Platform.name.label("platform_name"))
        .join(Platform, ShiftLog.platform_id == Platform.id)
        .where(ShiftLog.worker_id == worker_id)
        .order_by(ShiftLog.shift_date)
    )
    result = await db.execute(stmt)
    return [
        {
            "shift_date": str(s.shift_date),
            "platform": platform_name,
            "gross_earned": float(s.gross_earned),
            "platform_deductions": float(s.platform_deductions),
            "net_received": float(s.net_received),
            "hours_worked": float(s.hours_worked),
        }
        for s, platform_name in result.all()
    ]


# GET /api/earnings/worker/:id/summary
@router.get("/worker/{worker_id}/summary")
async def worker_summary(
    worker_id: uuid.UUID,
    date_from: date = None,
    date_to: date = None,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    if user["role"] == "worker" and user["user_id"] != str(worker_id):
        raise HTTPException(403, "Cannot access another worker's summary")

    date_conditions = ""
    params: dict = {"worker_id": str(worker_id)}

    if date_from:
        date_conditions += " AND shift_date >= :date_from"
        params["date_from"] = date_from
    if date_to:
        date_conditions += " AND shift_date <= :date_to"
        params["date_to"] = date_to

    aggregate_q = text(f"""
        SELECT
            SUM(gross_earned)                                        AS total_gross,
            SUM(platform_deductions)                                 AS total_deductions,
            SUM(net_received)                                        AS total_net,
            SUM(hours_worked)                                        AS total_hours,
            COUNT(*)                                                 AS shift_count,
            COUNT(*) FILTER (WHERE verification_status = 'verified') AS verified_count,
            AVG(platform_deductions / NULLIF(gross_earned, 0)) * 100 AS avg_commission_rate
        FROM shift_logs
        WHERE worker_id = :worker_id
        {date_conditions}
    """)

    r = await db.execute(aggregate_q, params)
    row = r.first()

    platform_q = text(f"""
        SELECT p.name AS platform,
            COUNT(*)                                                    AS shifts,
            SUM(sl.net_received)                                        AS net,
            ROUND(AVG(sl.platform_deductions / NULLIF(sl.gross_earned,0)) * 100, 2)
                                                                        AS commission_pct
        FROM shift_logs sl JOIN platforms p ON sl.platform_id = p.id
        WHERE sl.worker_id = :worker_id
        {date_conditions.replace('shift_date', 'sl.shift_date')}
        GROUP BY p.name ORDER BY net DESC
    """)
    pr = await db.execute(platform_q, params)

    return {
        "total_gross": float(row[0] or 0),
        "total_deductions": float(row[1] or 0),
        "total_net": float(row[2] or 0),
        "total_hours": float(row[3] or 0),
        "shift_count": int(row[4] or 0),
        "verified_count": int(row[5] or 0),
        "avg_commission_rate": round(float(row[6] or 0), 2),
        "platform_breakdown": [dict(r._mapping) for r in pr.fetchall()],
    }


# GET /api/earnings/worker/:id/trends
@router.get("/worker/{worker_id}/trends")
async def worker_trends(
    worker_id: uuid.UUID,
    months: int = Query(3, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    if user["role"] == "worker" and user["user_id"] != str(worker_id):
        raise HTTPException(403, "Cannot access another worker's trends")    

    params = {"worker_id": str(worker_id), "months": months}

    earnings_q = text("""
        SELECT DATE_TRUNC('week', shift_date)              AS week,
            SUM(net_received)                            AS net_income,
            AVG(net_received / NULLIF(hours_worked, 0))  AS avg_hourly
        FROM shift_logs
        WHERE worker_id = :worker_id
        AND shift_date >= NOW() - (:months * INTERVAL '1 month')
        GROUP BY week ORDER BY week
    """)

    commission_q = text("""
        SELECT DATE_TRUNC('week', sl.shift_date)            AS week,
            p.name                                        AS platform_name,
            AVG(sl.platform_deductions / NULLIF(sl.gross_earned, 0)) * 100
                                                            AS commission_rate
        FROM shift_logs sl JOIN platforms p ON sl.platform_id = p.id
        WHERE sl.worker_id = :worker_id
        AND sl.shift_date >= NOW() - (:months * INTERVAL '1 month')
        GROUP BY week, p.name ORDER BY week, p.name
    """)

    median_q = text("""
        SELECT zes.week,
            zes.platform_name,
            zes.median_net    AS city_median,
            zes.p25_net,
            zes.p75_net
        FROM zone_earnings_summary zes
        JOIN users u ON u.city_zone_id = zes.city_zone_id
        WHERE u.id = :worker_id
        AND zes.week >= NOW() - (:months * INTERVAL '1 month')
        ORDER BY zes.week
    """)

    r1 = await db.execute(earnings_q, params)
    r2 = await db.execute(commission_q, params)
    r3 = await db.execute(median_q, params)

    return {
        "earnings_trend":         [dict(row._mapping) for row in r1.fetchall()],
        "commission_trend":       [dict(row._mapping) for row in r2.fetchall()],
        "city_median_comparison": [dict(row._mapping) for row in r3.fetchall()],
    }


# GET /api/earnings/shifts/:id  ← must come AFTER static routes (/platforms, /worker/...)
@router.get("/shifts/{shift_id}")
async def get_shift(
    shift_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(ShiftLog, Platform.name.label("platform_name"))
        .join(Platform, ShiftLog.platform_id == Platform.id)
        .where(ShiftLog.id == shift_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(404, "Shift not found")
    shift, platform_name = row
    if user["role"] == "worker" and str(shift.worker_id) != user["user_id"]:
        raise HTTPException(403, "Cannot access another worker's shift")
    return _shift_dict(shift, platform_name)
