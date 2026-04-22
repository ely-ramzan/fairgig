from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import ShiftLog, Screenshot
from app.services.cloudinary_service import upload_screenshot

router = APIRouter(prefix="/api/earnings", tags=["screenshots"])


def _screenshot_dict(sc, url: str) -> dict:
    return {
        "id": str(sc.id),
        "shift_log_id": str(sc.shift_log_id),
        "url": url,
        "original_filename": sc.original_filename,
        "file_size_bytes": sc.file_size_bytes,
        "width": sc.width,
        "height": sc.height,
        "format": sc.format,
    }


@router.post("/shifts/{shift_id}/screenshot", status_code=201)
async def upload_shift_screenshot(
    shift_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("worker")),
):
    result = await db.execute(select(ShiftLog).where(ShiftLog.id == shift_id))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(404, "Shift not found")
    if str(shift.worker_id) != user["user_id"]:
        raise HTTPException(403, "Cannot upload screenshot for another worker's shift")

    file_bytes = await file.read()
    upload = upload_screenshot(file_bytes, user["user_id"], str(shift_id))

    existing = await db.execute(
        select(Screenshot).where(Screenshot.shift_log_id == shift_id)
    )
    old = existing.scalar_one_or_none()
    if old:
        await db.delete(old)
        await db.flush()

    screenshot = Screenshot(
        id=uuid.uuid4(),
        shift_log_id=shift_id,
        cloudinary_public_id=upload["public_id"],
        cloudinary_url=upload["secure_url"],
        original_filename=file.filename,
        file_size_bytes=len(file_bytes),
        width=upload.get("width"),
        height=upload.get("height"),
        format=upload.get("format"),
    )
    db.add(screenshot)

    if shift.verification_status in ("disputed", "unverifiable"):
        shift.verification_status = "pending"

    await db.commit()
    return _screenshot_dict(screenshot, upload["secure_url"])


@router.get("/shifts/{shift_id}/screenshot")
async def get_shift_screenshot(
    shift_id: uuid.UUID,
    thumbnail: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    # Workers may only access their own shift's screenshot
    if _user["role"] == "worker":
        shift_r = await db.execute(select(ShiftLog).where(ShiftLog.id == shift_id))
        owned_shift = shift_r.scalar_one_or_none()
        if not owned_shift or str(owned_shift.worker_id) != _user["user_id"]:
            raise HTTPException(403, "Cannot access another worker's screenshot")

    result = await db.execute(
        select(Screenshot).where(Screenshot.shift_log_id == shift_id)
    )
    screenshot = result.scalar_one_or_none()
    if not screenshot:
        raise HTTPException(404, "No screenshot found for this shift")

    url = screenshot.cloudinary_url
    if thumbnail:
        url = url.replace("/upload/", "/upload/w_200,h_200,c_fill/")

    return {"url": url, "original_filename": screenshot.original_filename}
