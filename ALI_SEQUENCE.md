# Ali's Build Sequence — FairGig

**Your services:** Earnings (8002) → Certificate (8006)  
**Your role:** Core data pipeline — shift logging, Cloudinary file storage, verification workflow, income certificates

---

## What's Already Done (By Shaheer)

- PostgreSQL DB is live, all 10 tables created via Alembic migrations
- SQLAlchemy models defined in `services/auth/app/models.py` — you COPY these, don't rewrite
- Auth Service running on `:8001` with `/api/auth/validate` endpoint
- Auth validate returns: `{ user_id: UUID, role: str, city_zone_id: UUID | null }`
- Seed data: 200+ workers, ~8000 shifts across 3 platforms, 5 workers with >20% income drops
- Views created: `zone_earnings_summary` (regular) + `monthly_worker_totals` (materialized)
- `.env` at root with `DATABASE_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

---

## Key Patterns To Follow (From Auth Service Code)

### config.py pattern
```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../../.env", env_file_encoding="utf-8", extra="ignore")
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/fairgig"
    auth_service_url: str = "http://localhost:8001"
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

@lru_cache
def get_settings() -> Settings: return Settings()
```

### database.py pattern (copy from auth exactly)
The auth service has `get_db` and `get_db_with_rls`. You need `get_db`. Copy `database.py` as-is.

### dependencies.py pattern (HTTP call to Auth Service)
```python
import httpx
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import get_settings

bearer = HTTPBearer()

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.auth_service_url}/api/auth/validate",
            headers={"Authorization": f"Bearer {creds.credentials}"}
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return resp.json()  # {"user_id": "...", "role": "...", "city_zone_id": "..."}

def require_role(*roles: str):
    async def _check(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {list(roles)}")
        return user
    return _check
```

---

## PHASE A1 — Earnings Service: Scaffolding (START HERE)

> **Why first:** Service needs to boot before anything else. Get it to port 8002 with auth working. 15 minutes of setup saves hours of broken imports later.

### A1.1 — Create folder structure
```
services/earnings/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py          ← copy from services/auth/app/database.py
│   ├── models.py            ← copy from services/auth/app/models.py
│   ├── dependencies.py      ← HTTP call pattern above
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── shifts.py
│   │   ├── screenshots.py
│   │   └── verification.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── cloudinary_service.py
│   │   ├── import_service.py
│   │   └── verification_service.py
│   └── schemas/
│       ├── __init__.py
│       └── earnings.py
├── requirements.txt
└── README.md
```

### A1.2 — requirements.txt
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
pydantic==2.10.4
pydantic-settings==2.7.1
httpx==0.28.1
python-dotenv==1.0.1
cloudinary==1.41.0
openpyxl==3.1.2
python-multipart==0.0.12
pytest==8.3.4
pytest-asyncio==0.24.0
```

### A1.3 — main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.shifts import router as shifts_router
from app.routes.screenshots import router as screenshots_router
from app.routes.verification import router as verification_router

app = FastAPI(title="FairGig Earnings Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(shifts_router)
app.include_router(screenshots_router)
app.include_router(verification_router)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "earnings"}
```

### A1.4 — config.py
Use the pattern at the top of this document. Cloudinary vars come from `.env` at project root.

### A1.5 — database.py + models.py
```bash
# Copy from auth service — do NOT rewrite
cp services/auth/app/database.py services/earnings/app/database.py
cp services/auth/app/models.py   services/earnings/app/models.py
```

### A1.6 — dependencies.py
Use the pattern at the top of this document exactly.

### ✅ CHECKPOINT A1
```bash
cd services/earnings
pip install -r requirements.txt
uvicorn app.main:app --port 8002 --reload

curl http://localhost:8002/health
# Expected: {"status": "ok", "service": "earnings"}

# Try without token — should 403, NOT crash
curl http://localhost:8002/api/earnings/shifts
# Expected: 403 {"detail": "Not authenticated"}
```

---

## PHASE A2 — Earnings: Shift CRUD

> The `/worker/:id/shifts-raw` endpoint at the end of this phase is **critical for Hamza** — he can't test Anomaly `/analyze-worker` without it.

### A2.1 — schemas/earnings.py
```python
from pydantic import BaseModel, field_validator
from decimal import Decimal
from typing import Optional, List
from datetime import date

class ShiftCreate(BaseModel):
    platform_id: str
    shift_date: date
    hours_worked: Decimal
    gross_earned: Decimal
    platform_deductions: Decimal
    net_received: Decimal

    @field_validator("net_received")
    @classmethod
    def validate_net(cls, v, info):
        data = info.data
        if "gross_earned" in data and "platform_deductions" in data:
            expected = data["gross_earned"] - data["platform_deductions"]
            tolerance = expected * Decimal("0.02")
            if abs(v - expected) > tolerance:
                raise ValueError(
                    f"net_received must be within 2% of gross - deductions (expected ~{expected})"
                )
        return v

class ShiftOut(BaseModel):
    id: str
    worker_id: str
    platform_id: str
    shift_date: date
    hours_worked: float
    gross_earned: float
    platform_deductions: float
    net_received: float
    verification_status: str
    import_source: str
    created_at: str

    model_config = {"from_attributes": True}

class PaginatedShifts(BaseModel):
    items: List[ShiftOut]
    total: int
    page: int
    limit: int
    total_pages: int

class VerifyRequest(BaseModel):
    status: str
    notes: Optional[str] = None
    verifier_gross: Optional[Decimal] = None
    verifier_deductions: Optional[Decimal] = None
```

### A2.2 — routes/shifts.py
```python
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import ShiftLog, Platform
from app.schemas.earnings import ShiftCreate
from datetime import date
import uuid

router = APIRouter(prefix="/api/earnings", tags=["earnings"])


# POST /api/earnings/shifts
@router.post("/shifts", status_code=201)
async def create_shift(
    body: ShiftCreate,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("worker")),
):
    shift = ShiftLog(
        worker_id=uuid.UUID(user["user_id"]),
        platform_id=uuid.UUID(body.platform_id),
        shift_date=body.shift_date,
        hours_worked=body.hours_worked,
        gross_earned=body.gross_earned,
        platform_deductions=body.platform_deductions,
        net_received=body.net_received,
        import_source="manual",
    )
    db.add(shift)
    await db.commit()
    await db.refresh(shift)
    return shift


# GET /api/earnings/shifts (paginated + filterable)
@router.get("/shifts")
async def list_shifts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    platform_id: str = None,
    status: str = None,
    date_from: date = None,
    date_to: date = None,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    stmt = select(ShiftLog).where(ShiftLog.worker_id == uuid.UUID(user["user_id"]))
    if platform_id:
        stmt = stmt.where(ShiftLog.platform_id == uuid.UUID(platform_id))
    if status:
        stmt = stmt.where(ShiftLog.verification_status == status)
    if date_from:
        stmt = stmt.where(ShiftLog.shift_date >= date_from)
    if date_to:
        stmt = stmt.where(ShiftLog.shift_date <= date_to)

    total_r = await db.execute(select(func.count()).select_from(stmt.subquery()))
    total = total_r.scalar()

    stmt = stmt.order_by(ShiftLog.shift_date.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    shifts = result.scalars().all()

    return {
        "items": shifts,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


# GET /api/earnings/shifts/:id
@router.get("/shifts/{shift_id}")
async def get_shift(
    shift_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = await db.execute(select(ShiftLog).where(ShiftLog.id == uuid.UUID(shift_id)))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(404, "Shift not found")
    if user["role"] == "worker" and str(shift.worker_id) != user["user_id"]:
        raise HTTPException(403, "Cannot access another worker's shift")
    return shift


# GET /api/earnings/platforms
@router.get("/platforms")
async def list_platforms(
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await db.execute(select(Platform).order_by(Platform.name))
    return result.scalars().all()


# GET /api/earnings/worker/:id/shifts-raw  ← HAMZA NEEDS THIS for Anomaly /analyze-worker
@router.get("/worker/{worker_id}/shifts-raw")
async def get_worker_shifts_raw(
    worker_id: str,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Flat shift list for Anomaly Service consumption."""
    stmt = (
        select(ShiftLog, Platform.name.label("platform_name"))
        .join(Platform, ShiftLog.platform_id == Platform.id)
        .where(ShiftLog.worker_id == uuid.UUID(worker_id))
        .order_by(ShiftLog.shift_date)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        {
            "shift_date": str(s.shift_date),
            "platform": platform_name,
            "gross_earned": float(s.gross_earned),
            "platform_deductions": float(s.platform_deductions),
            "net_received": float(s.net_received),
            "hours_worked": float(s.hours_worked),
        }
        for s, platform_name in rows
    ]
```

### ✅ CHECKPOINT A2
```bash
# Create a shift (replace <token> and <platform_uuid> with real values)
curl -X POST http://localhost:8002/api/earnings/shifts \
  -H "Authorization: Bearer <worker_token>" \
  -H "Content-Type: application/json" \
  -d '{"platform_id":"<uuid>","shift_date":"2026-01-15","hours_worked":6,
       "gross_earned":2500,"platform_deductions":550,"net_received":1950}'
# Expected: 201 with shift object

# List shifts
curl -H "Authorization: Bearer <worker_token>" http://localhost:8002/api/earnings/shifts
# Expected: {"items":[...],"total":1,"page":1,"limit":20,"total_pages":1}

# Bad math validation (net is wrong, should fail)
curl -X POST http://localhost:8002/api/earnings/shifts \
  -H "Authorization: Bearer <worker_token>" \
  -H "Content-Type: application/json" \
  -d '{"platform_id":"<uuid>","shift_date":"2026-01-16","hours_worked":6,
       "gross_earned":2500,"platform_deductions":550,"net_received":500}'
# Expected: 422 Unprocessable Entity with validation error

# Shifts-raw (tell Hamza this works)
curl -H "Authorization: Bearer <worker_token>" \
  http://localhost:8002/api/earnings/worker/<worker_id>/shifts-raw
# Expected: [{shift_date, platform, gross_earned, ...}, ...]
```

---

## PHASE A3 — Earnings: CSV/Excel Import + Cloudinary

### A3.1 — services/cloudinary_service.py
```python
import cloudinary
import cloudinary.uploader
from app.config import get_settings


def _init():
    s = get_settings()
    cloudinary.config(
        cloud_name=s.cloudinary_cloud_name,
        api_key=s.cloudinary_api_key,
        api_secret=s.cloudinary_api_secret,
    )


def upload_raw_file(file_bytes: bytes, worker_id: str, import_id: str, filename: str) -> dict:
    _init()
    return cloudinary.uploader.upload(
        file_bytes,
        folder=f"fairgig/imports/{worker_id}",
        public_id=import_id,
        resource_type="raw",
        allowed_formats=["csv", "xlsx", "xls"],
        max_file_size=10_000_000,
    )


def upload_screenshot(file_bytes: bytes, worker_id: str, shift_id: str) -> dict:
    _init()
    return cloudinary.uploader.upload(
        file_bytes,
        folder=f"fairgig/screenshots/{worker_id}",
        public_id=shift_id,
        resource_type="image",
        allowed_formats=["jpg", "jpeg", "png"],
        max_file_size=5_000_000,
        transformation=[{"width": 1200, "crop": "limit"}, {"quality": "auto:good"}],
    )
```

### A3.2 — services/import_service.py
```python
import csv, io
from datetime import datetime
from decimal import Decimal, InvalidOperation

HEADER_ALIASES = {
    "shift_date":           ["date", "shift_date", "shift date", "work_date"],
    "platform":             ["platform", "app", "platform_name"],
    "gross_earned":         ["gross", "gross_earned", "total_earned", "earnings"],
    "platform_deductions":  ["deductions", "platform_deductions", "commission", "fee"],
    "net_received":         ["net", "net_received", "take_home"],
    "hours_worked":         ["hours", "hours_worked", "duration"],
}


def normalize_header(header: str) -> str:
    h = header.strip().lower().replace(" ", "_")
    for canonical, aliases in HEADER_ALIASES.items():
        if h in aliases:
            return canonical
    return h


def parse_date(value: str):
    for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]:
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            pass
    raise ValueError(f"Cannot parse date: {value!r}")


def parse_csv(content: bytes, platform_map: dict) -> tuple[list, list]:
    """Returns (valid_rows, errors). platform_map: {name.lower(): uuid_str}"""
    text = content.decode("utf-8-sig", errors="replace")
    delimiter = "," if text.count(",") >= text.count(";") else ";"
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    raw_headers = reader.fieldnames or []
    header_map = {h: normalize_header(h) for h in raw_headers}

    valid_rows, errors = [], []
    for i, row in enumerate(reader, start=2):
        normalized = {header_map.get(k, k): (v or "").strip() for k, v in row.items()}
        try:
            platform_name = normalized.get("platform", "").lower()
            platform_id = platform_map.get(platform_name)
            if not platform_id:
                raise ValueError(f"Platform '{normalized.get('platform')}' not found")

            gross = Decimal(normalized["gross_earned"])
            deductions = Decimal(normalized["platform_deductions"])
            net = Decimal(normalized["net_received"])
            hours = Decimal(normalized["hours_worked"])
            shift_date = parse_date(normalized["shift_date"])

            expected = gross - deductions
            if abs(net - expected) > expected * Decimal("0.02"):
                raise ValueError(f"net_received mismatch (expected ~{expected})")

            valid_rows.append({
                "platform_id": platform_id,
                "shift_date": shift_date,
                "gross_earned": gross,
                "platform_deductions": deductions,
                "net_received": net,
                "hours_worked": hours,
            })
        except Exception as e:
            errors.append({"row": i, "reason": str(e)})

    return valid_rows, errors


def parse_excel(content: bytes, platform_map: dict) -> tuple[list, list]:
    """Same validation as parse_csv but reads .xlsx/.xls via openpyxl."""
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], []

    raw_headers = [str(h) if h is not None else "" for h in rows[0]]
    header_map = {h: normalize_header(h) for h in raw_headers}

    valid_rows, errors = [], []
    for i, row in enumerate(rows[1:], start=2):
        normalized = {header_map.get(raw_headers[j], raw_headers[j]): str(v or "").strip()
                      for j, v in enumerate(row)}
        try:
            platform_name = normalized.get("platform", "").lower()
            platform_id = platform_map.get(platform_name)
            if not platform_id:
                raise ValueError(f"Platform '{normalized.get('platform')}' not found")

            gross = Decimal(normalized["gross_earned"])
            deductions = Decimal(normalized["platform_deductions"])
            net = Decimal(normalized["net_received"])
            hours = Decimal(normalized["hours_worked"])
            shift_date = parse_date(normalized["shift_date"])

            expected = gross - deductions
            if abs(net - expected) > expected * Decimal("0.02"):
                raise ValueError(f"net_received mismatch (expected ~{expected})")

            valid_rows.append({
                "platform_id": platform_id,
                "shift_date": shift_date,
                "gross_earned": gross,
                "platform_deductions": deductions,
                "net_received": net,
                "hours_worked": hours,
            })
        except Exception as e:
            errors.append({"row": i, "reason": str(e)})

    return valid_rows, errors
```

### A3.3 — POST /api/earnings/shifts/import (add to routes/shifts.py)

> **IMPORTANT:** Register this route BEFORE `GET /shifts/{shift_id}` or FastAPI will match `/import` as a shift_id.

```python
from fastapi import UploadFile, File
from app.models import FileUpload
from app.services.cloudinary_service import upload_raw_file
from app.services.import_service import parse_csv, parse_excel


# POST /api/earnings/shifts/import
@router.post("/shifts/import")
async def import_shifts(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("worker")),
):
    content = await file.read()
    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ("csv", "xlsx", "xls"):
        raise HTTPException(400, "Only CSV, XLSX, XLS files allowed")

    import_id = str(uuid.uuid4())
    worker_id = user["user_id"]

    upload_result = upload_raw_file(content, worker_id, import_id, file.filename)

    plat_result = await db.execute(select(Platform))
    platform_map = {p.name.lower(): str(p.id) for p in plat_result.scalars().all()}

    if ext == "csv":
        valid_rows, errors = parse_csv(content, platform_map)
    else:
        valid_rows, errors = parse_excel(content, platform_map)

    file_upload = FileUpload(
        id=uuid.UUID(import_id),
        worker_id=uuid.UUID(worker_id),
        cloudinary_public_id=upload_result["public_id"],
        cloudinary_url=upload_result["secure_url"],
        original_filename=file.filename,
        file_type=ext,
        file_size_bytes=len(content),
        rows_errored=len(errors),
        import_status="completed",
    )
    db.add(file_upload)

    inserted = 0
    for row in valid_rows:
        try:
            shift = ShiftLog(
                worker_id=uuid.UUID(worker_id),
                file_upload_id=uuid.UUID(import_id),
                import_source="csv",
                **row,
            )
            db.add(shift)
            await db.flush()
            inserted += 1
        except Exception:
            pass  # duplicate constraint → skip

    file_upload.rows_imported = inserted
    file_upload.rows_skipped = len(valid_rows) - inserted
    file_upload.error_summary = errors if errors else None
    await db.commit()

    return {
        "rows_imported": inserted,
        "rows_skipped": len(valid_rows) - inserted,
        "rows_errored": len(errors),
        "errors": errors[:10],
        "cloudinary_url": upload_result["secure_url"],
    }


# GET /api/earnings/imports
@router.get("/imports")
async def list_imports(
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("worker")),
):
    result = await db.execute(
        select(FileUpload)
        .where(FileUpload.worker_id == uuid.UUID(user["user_id"]))
        .order_by(FileUpload.created_at.desc())
    )
    return result.scalars().all()
```

### ✅ CHECKPOINT A3
```bash
# Create a sample.csv with 10 rows, 2 with wrong net values
# Columns: shift_date, platform, gross_earned, platform_deductions, net_received, hours_worked

curl -X POST http://localhost:8002/api/earnings/shifts/import \
  -H "Authorization: Bearer <worker_token>" \
  -F "file=@sample.csv"
# Expected: {"rows_imported":8,"rows_skipped":0,"rows_errored":2,
#            "errors":[{"row":...,"reason":"net_received mismatch..."},...],
#            "cloudinary_url":"https://res.cloudinary.com/..."}

# Check Cloudinary dashboard — file should appear under fairgig/imports/<worker_id>/
```

---

## PHASE A4 — Earnings: Screenshot + Verification

### A4.1 — services/verification_service.py
```python
VALID_TRANSITIONS = {
    "pending":      ["verified", "disputed", "unverifiable"],
    "disputed":     ["pending"],    # worker re-uploads → resets
    "verified":     [],             # FINAL
    "unverifiable": [],             # FINAL
}


def can_transition(current: str, target: str) -> bool:
    return target in VALID_TRANSITIONS.get(current, [])
```

### A4.2 — routes/screenshots.py
```python
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models import ShiftLog, Screenshot
from app.services.cloudinary_service import upload_screenshot
import uuid

router = APIRouter(prefix="/api/earnings", tags=["screenshots"])


# POST /api/earnings/shifts/:id/screenshot
@router.post("/shifts/{shift_id}/screenshot", status_code=201)
async def upload_shift_screenshot(
    shift_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("worker")),
):
    result = await db.execute(select(ShiftLog).where(ShiftLog.id == uuid.UUID(shift_id)))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(404, "Shift not found")
    if str(shift.worker_id) != user["user_id"]:
        raise HTTPException(403, "Cannot upload screenshot for another worker's shift")

    content = await file.read()
    upload = upload_screenshot(content, user["user_id"], shift_id)

    existing = await db.execute(
        select(Screenshot).where(Screenshot.shift_log_id == uuid.UUID(shift_id))
    )
    old = existing.scalar_one_or_none()
    if old:
        await db.delete(old)

    screenshot = Screenshot(
        shift_log_id=uuid.UUID(shift_id),
        cloudinary_public_id=upload["public_id"],
        cloudinary_url=upload["secure_url"],
        original_filename=file.filename,
        file_size_bytes=len(content),
        width=upload.get("width"),
        height=upload.get("height"),
        format=upload.get("format"),
    )
    db.add(screenshot)

    # If disputed, re-upload resets to pending
    if shift.verification_status == "disputed":
        shift.verification_status = "pending"

    await db.commit()
    return screenshot


# GET /api/earnings/shifts/:id/screenshot
@router.get("/shifts/{shift_id}/screenshot")
async def get_shift_screenshot(
    shift_id: str,
    thumbnail: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    result = await db.execute(
        select(Screenshot).where(Screenshot.shift_log_id == uuid.UUID(shift_id))
    )
    screenshot = result.scalar_one_or_none()
    if not screenshot:
        raise HTTPException(404, "No screenshot found for this shift")

    url = screenshot.cloudinary_url
    if thumbnail:
        url = url.replace("/upload/", "/upload/w_200,h_200,c_fill/")

    return {"url": url, "original_filename": screenshot.original_filename}
```

### A4.3 — routes/verification.py
```python
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.dependencies import require_role
from app.models import ShiftLog, Verification
from app.schemas.earnings import VerifyRequest
from app.services.verification_service import can_transition
import uuid

router = APIRouter(prefix="/api/earnings", tags=["verification"])


# GET /api/earnings/verification-queue (verifier only, FIFO)
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
        "items": shifts,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": (total + limit - 1) // limit,
    }


# POST /api/earnings/shifts/:id/verify (verifier only)
@router.post("/shifts/{shift_id}/verify")
async def verify_shift(
    shift_id: str,
    body: VerifyRequest,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("verifier")),
):
    VALID_STATUSES = {"verified", "disputed", "unverifiable"}
    if body.status not in VALID_STATUSES:
        raise HTTPException(400, f"status must be one of: {VALID_STATUSES}")

    result = await db.execute(select(ShiftLog).where(ShiftLog.id == uuid.UUID(shift_id)))
    shift = result.scalar_one_or_none()
    if not shift:
        raise HTTPException(404, "Shift not found")

    if not can_transition(shift.verification_status, body.status):
        raise HTTPException(
            409,
            f"Cannot transition from '{shift.verification_status}' to '{body.status}'"
        )

    shift.verification_status = body.status

    existing = await db.execute(
        select(Verification).where(Verification.shift_log_id == uuid.UUID(shift_id))
    )
    old = existing.scalar_one_or_none()
    if old:
        await db.delete(old)

    verification = Verification(
        shift_log_id=uuid.UUID(shift_id),
        verifier_id=uuid.UUID(user["user_id"]),
        status=body.status,
        notes=body.notes,
        verifier_gross=body.verifier_gross,
        verifier_deductions=body.verifier_deductions,
    )
    db.add(verification)
    await db.commit()
    return shift
```

### ✅ CHECKPOINT A4
```bash
# Full verification workflow:

# 1. Create shift
SHIFT_ID=$(curl -s -X POST http://localhost:8002/api/earnings/shifts \
  -H "Authorization: Bearer <worker_token>" -H "Content-Type: application/json" \
  -d '{"platform_id":"<uuid>","shift_date":"2026-02-01","hours_worked":5,
       "gross_earned":2000,"platform_deductions":440,"net_received":1560}' | jq -r '.id')

# 2. Upload screenshot
curl -X POST http://localhost:8002/api/earnings/shifts/$SHIFT_ID/screenshot \
  -H "Authorization: Bearer <worker_token>" \
  -F "file=@screenshot.png"
# Expected: 201 with screenshot metadata

# 3. Verify (as verifier token)
curl -X POST http://localhost:8002/api/earnings/shifts/$SHIFT_ID/verify \
  -H "Authorization: Bearer <verifier_token>" -H "Content-Type: application/json" \
  -d '{"status":"verified","notes":"Looks correct"}'
# Expected: shift with verification_status="verified"

# 4. Try to verify again (should fail)
curl -X POST http://localhost:8002/api/earnings/shifts/$SHIFT_ID/verify \
  -H "Authorization: Bearer <verifier_token>" -H "Content-Type: application/json" \
  -d '{"status":"disputed"}'
# Expected: 409 "Cannot transition from 'verified' to 'disputed'"

# 5. Dispute path: new shift → verify as disputed → re-upload screenshot → status resets to pending
```

---

## PHASE A5 — Earnings: Worker Summary + Trends

### A5.1 — Add to routes/shifts.py: Worker Summary
```python
# GET /api/earnings/worker/:id/summary
@router.get("/worker/{worker_id}/summary")
async def worker_summary(
    worker_id: str,
    date_from: date = None,
    date_to: date = None,
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    # Workers can only see own summary; advocates see any
    if user["role"] == "worker" and user["user_id"] != worker_id:
        raise HTTPException(403, "Cannot access another worker's summary")

    aggregate_q = text("""
        SELECT
            SUM(gross_earned)                                         AS total_gross,
            SUM(platform_deductions)                                  AS total_deductions,
            SUM(net_received)                                         AS total_net,
            SUM(hours_worked)                                         AS total_hours,
            COUNT(*)                                                  AS shift_count,
            COUNT(*) FILTER (WHERE verification_status = 'verified')  AS verified_count,
            AVG(platform_deductions / NULLIF(gross_earned, 0)) * 100  AS avg_commission_rate
        FROM shift_logs
        WHERE worker_id = :worker_id
          AND (:date_from IS NULL OR shift_date >= :date_from)
          AND (:date_to   IS NULL OR shift_date <= :date_to)
    """)
    r = await db.execute(aggregate_q, {"worker_id": worker_id,
                                       "date_from": date_from, "date_to": date_to})
    row = r.fetchone()

    platform_q = text("""
        SELECT p.name AS platform,
               COUNT(*)                                                   AS shifts,
               SUM(sl.net_received)                                       AS net,
               ROUND(AVG(sl.platform_deductions / NULLIF(sl.gross_earned,0)) * 100, 2)
                                                                          AS commission_pct
        FROM shift_logs sl JOIN platforms p ON sl.platform_id = p.id
        WHERE sl.worker_id = :worker_id
          AND (:date_from IS NULL OR sl.shift_date >= :date_from)
          AND (:date_to   IS NULL OR sl.shift_date <= :date_to)
        GROUP BY p.name ORDER BY net DESC
    """)
    pr = await db.execute(platform_q, {"worker_id": worker_id,
                                       "date_from": date_from, "date_to": date_to})

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
```

### A5.2 — Add to routes/shifts.py: Worker Trends
```python
# GET /api/earnings/worker/:id/trends
@router.get("/worker/{worker_id}/trends")
async def worker_trends(
    worker_id: str,
    months: int = Query(3, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    if user["role"] == "worker" and user["user_id"] != worker_id:
        raise HTTPException(403, "Cannot access another worker's trends")

    params = {"worker_id": worker_id, "months": months}

    earnings_q = text("""
        SELECT DATE_TRUNC('week', shift_date) AS week,
               SUM(net_received)                        AS net_income,
               AVG(net_received / NULLIF(hours_worked, 0)) AS avg_hourly
        FROM shift_logs
        WHERE worker_id = :worker_id
          AND shift_date >= NOW() - MAKE_INTERVAL(months => :months)
        GROUP BY week ORDER BY week
    """)

    commission_q = text("""
        SELECT DATE_TRUNC('week', sl.shift_date)          AS week,
               p.name                                      AS platform_name,
               AVG(sl.platform_deductions / NULLIF(sl.gross_earned, 0)) * 100
                                                           AS commission_rate
        FROM shift_logs sl JOIN platforms p ON sl.platform_id = p.id
        WHERE sl.worker_id = :worker_id
          AND sl.shift_date >= NOW() - MAKE_INTERVAL(months => :months)
        GROUP BY week, p.name ORDER BY week, p.name
    """)

    median_q = text("""
        SELECT zes.week,
               zes.platform_name,
               zes.median_net                             AS city_median,
               zes.p25_net,
               zes.p75_net
        FROM zone_earnings_summary zes
        JOIN users u ON u.city_zone_id = zes.city_zone_id
        WHERE u.id = :worker_id
          AND zes.week >= NOW() - MAKE_INTERVAL(months => :months)
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
```

### ✅ CHECKPOINT A5
```bash
# Summary for a worker
curl -H "Authorization: Bearer <worker_token>" \
  "http://localhost:8002/api/earnings/worker/<worker_id>/summary?date_from=2026-01-01"
# Expected: total_gross, total_net, verified_count, platform_breakdown

# Trends — DHA Careem worker should show commission spike in week 8
curl -H "Authorization: Bearer <worker_token>" \
  "http://localhost:8002/api/earnings/worker/<worker_id>/trends?months=3"
# Expected: earnings_trend (weekly), commission_trend (by platform), city_median_comparison

# Advocate accessing another worker's summary
curl -H "Authorization: Bearer <advocate_token>" \
  "http://localhost:8002/api/earnings/worker/<worker_id>/summary"
# Expected: 200 (advocates can see any worker's data)
```

---

## PHASE A6 — Certificate Renderer (port 8006)

> Build this immediately after A5 — it calls the `/summary` endpoint you just built.

### A6.1 — Folder structure
```
services/certificate/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   └── routes/
│       ├── __init__.py
│       └── certificate.py
├── templates/
│   └── certificate.html
└── requirements.txt
```

### A6.2 — requirements.txt
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
jinja2==3.1.4
httpx==0.28.1
pydantic==2.10.4
pydantic-settings==2.7.1
python-dotenv==1.0.1
```

### A6.3 — config.py
```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../../.env", env_file_encoding="utf-8", extra="ignore")
    auth_service_url: str = "http://localhost:8001"
    earnings_service_url: str = "http://localhost:8002"

@lru_cache
def get_settings() -> Settings: return Settings()
```

### A6.4 — dependencies.py (same HTTP auth pattern)
```python
import httpx
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import get_settings

bearer = HTTPBearer()

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.auth_service_url}/api/auth/validate",
            headers={"Authorization": f"Bearer {creds.credentials}"}
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return resp.json()
```

### A6.5 — main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.certificate import router as cert_router

app = FastAPI(title="FairGig Certificate Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(cert_router)

@app.get("/health")
async def health():
    return {"status": "ok", "service": "certificate"}
```

### A6.6 — templates/certificate.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>FairGig Income Certificate</title>
<style>
  @page { size: A4; margin: 20mm; }
  @media print { .no-print { display: none; } body { margin: 0; } }
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; color: #333; }
  h1 { font-size: 22px; text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; }
  .cert-id { text-align: center; color: #666; font-size: 12px; margin-bottom: 20px; }
  .section { margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #ccc; padding: 8px 12px; text-align: left; }
  th { background: #f5f5f5; font-weight: bold; }
  .disclaimer { font-size: 11px; color: #666; margin-top: 30px; border-top: 1px solid #ccc; padding-top: 10px; }
</style>
</head>
<body>
  <h1>FairGig Income Certificate</h1>
  <div class="cert-id">Certificate #{{ cert_id }} &nbsp;|&nbsp; Generated: {{ generated_date }}</div>

  <div class="section">
    <strong>Worker:</strong> {{ worker_name }}<br>
    <strong>Period:</strong> {{ date_from }} to {{ date_to }}
  </div>

  <div class="section">
    <table>
      <tr><th>Metric</th><th>Amount (PKR)</th></tr>
      <tr><td>Total Gross Earned</td><td>{{ total_gross }}</td></tr>
      <tr><td>Platform Deductions</td><td>{{ total_deductions }}</td></tr>
      <tr><td><strong>Net Received</strong></td><td><strong>{{ total_net }}</strong></td></tr>
      <tr><td>Total Hours Worked</td><td>{{ total_hours }}</td></tr>
      <tr><td>Effective Hourly Rate</td><td>{{ hourly_rate }}</td></tr>
      <tr><td>Total Shifts</td><td>{{ shift_count }}</td></tr>
      <tr><td>Verified Shifts</td><td>{{ verified_count }}</td></tr>
    </table>
  </div>

  {% if platform_breakdown %}
  <div class="section">
    <h3>Platform Breakdown</h3>
    <table>
      <tr><th>Platform</th><th>Shifts</th><th>Net Earned (PKR)</th><th>Avg Commission</th></tr>
      {% for p in platform_breakdown %}
      <tr>
        <td>{{ p.platform }}</td>
        <td>{{ p.shifts }}</td>
        <td>{{ "%.2f"|format(p.net) }}</td>
        <td>{{ p.commission_pct }}%</td>
      </tr>
      {% endfor %}
    </table>
  </div>
  {% endif %}

  <div class="disclaimer">
    This certificate reflects self-reported earnings, verified where possible.
    FairGig does not guarantee the accuracy of the reported figures.
    Verified shifts: {{ verified_count }} of {{ shift_count }}.
  </div>
</body>
</html>
```

### A6.7 — routes/certificate.py
```python
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from datetime import date, datetime
import httpx, uuid

from app.dependencies import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/certificate", tags=["certificate"])
templates = Jinja2Templates(directory="templates")
bearer = HTTPBearer()


async def _fetch_summary(worker_id: str, token: str, date_from: date, date_to: date) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.earnings_service_url}/api/earnings/worker/{worker_id}/summary",
            headers={"Authorization": f"Bearer {token}"},
            params={"date_from": str(date_from), "date_to": str(date_to)},
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Could not fetch earnings summary from Earnings Service")
    return resp.json()


def _build_context(user: dict, summary: dict, date_from: date, date_to: date) -> dict:
    cert_id = str(uuid.uuid4())[:8].upper()
    total_hours = summary.get("total_hours", 0)
    total_net = summary.get("total_net", 0)
    return {
        "cert_id": cert_id,
        "generated_date": datetime.now().strftime("%Y-%m-%d"),
        "worker_name": user.get("display_name", f"Worker {user['user_id'][:8]}"),
        "date_from": str(date_from),
        "date_to": str(date_to),
        "total_gross": f"{summary.get('total_gross', 0):,.2f}",
        "total_deductions": f"{summary.get('total_deductions', 0):,.2f}",
        "total_net": f"{total_net:,.2f}",
        "total_hours": f"{total_hours:.1f}",
        "hourly_rate": f"{total_net / max(total_hours, 0.01):,.2f}",
        "shift_count": summary.get("shift_count", 0),
        "verified_count": summary.get("verified_count", 0),
        "platform_breakdown": summary.get("platform_breakdown", []),
    }


# GET /api/certificate/preview — JSON response for frontend
@router.get("/preview")
async def certificate_preview(
    date_from: date = Query(...),
    date_to: date = Query(...),
    user: dict = Depends(get_current_user),
    creds: HTTPAuthorizationCredentials = Depends(bearer),
):
    summary = await _fetch_summary(user["user_id"], creds.credentials, date_from, date_to)
    return _build_context(user, summary, date_from, date_to)


# GET /api/certificate/generate — print-ready HTML
@router.get("/generate", response_class=HTMLResponse)
async def certificate_generate(
    date_from: date = Query(...),
    date_to: date = Query(...),
    user: dict = Depends(get_current_user),
    creds: HTTPAuthorizationCredentials = Depends(bearer),
):
    summary = await _fetch_summary(user["user_id"], creds.credentials, date_from, date_to)
    context = _build_context(user, summary, date_from, date_to)
    return templates.TemplateResponse(
        "certificate.html",
        {"request": {}, **context},
    )
```

### ✅ CHECKPOINT A6
```bash
cd services/certificate
pip install -r requirements.txt
uvicorn app.main:app --port 8006 --reload

# JSON preview
curl "http://localhost:8006/api/certificate/preview?date_from=2026-01-01&date_to=2026-03-31" \
  -H "Authorization: Bearer <worker_token>"
# Expected: {"cert_id":"ABC12345","total_gross":"...","shift_count":...}

# Print-ready HTML
curl "http://localhost:8006/api/certificate/generate?date_from=2026-01-01&date_to=2026-03-31" \
  -H "Authorization: Bearer <worker_token>"
# Expected: full HTML page — open in browser and use Ctrl+P to print/preview
```

---

## INTEGRATION TASKS (Hour 9-11)

| # | Task | What to do |
|---|------|-----------|
| I1 | Certificate calls Earnings summary | Confirm `/generate` returns correct HTML using real seeded shifts |
| I4 | Auth validation on every endpoint | No Bearer → 401. Worker token on verifier queue → 403 |
| I5 | Full workflow test | register → log shift → import CSV → upload screenshot → verify → trends → certificate |
| I9 | Postman collection | Export all 13 Earnings + 2 Certificate endpoints. Share with Hamza for combined collection |
| I10 | Update READMEs | Start commands, env vars needed, endpoint list |

### I5 — Full workflow curl script
```bash
BASE=http://localhost:8002
TOKEN="<worker_token>"
VERIFIER="<verifier_token>"

# 1. List platforms
PLATFORM_ID=$(curl -s -H "Authorization: Bearer $TOKEN" $BASE/api/earnings/platforms | jq -r '.[0].id')

# 2. Create shift
SHIFT=$(curl -s -X POST $BASE/api/earnings/shifts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"platform_id\":\"$PLATFORM_ID\",\"shift_date\":\"2026-02-15\",
       \"hours_worked\":6,\"gross_earned\":2500,
       \"platform_deductions\":550,\"net_received\":1950}")
SHIFT_ID=$(echo $SHIFT | jq -r '.id')

# 3. Upload screenshot
curl -s -X POST $BASE/api/earnings/shifts/$SHIFT_ID/screenshot \
  -H "Authorization: Bearer $TOKEN" -F "file=@screenshot.png"

# 4. Verify as verifier
curl -s -X POST $BASE/api/earnings/shifts/$SHIFT_ID/verify \
  -H "Authorization: Bearer $VERIFIER" -H "Content-Type: application/json" \
  -d '{"status":"verified","notes":"Amount confirmed"}'

# 5. Check trends
WORKER_ID=$(echo $SHIFT | jq -r '.worker_id')
curl -s -H "Authorization: Bearer $TOKEN" \
  "$BASE/api/earnings/worker/$WORKER_ID/trends?months=3"

# 6. Generate certificate
curl -s "http://localhost:8006/api/certificate/generate?date_from=2026-01-01&date_to=2026-03-31" \
  -H "Authorization: Bearer $TOKEN" -o certificate.html
echo "Certificate saved to certificate.html"
```

---

## Start Commands (Final)

```bash
# Earnings Service (port 8002)
cd services/earnings
pip install -r requirements.txt
uvicorn app.main:app --port 8002 --reload

# Certificate Service (port 8006) — start AFTER earnings is up
cd services/certificate
pip install -r requirements.txt
uvicorn app.main:app --port 8006 --reload
```

---

## Files To Copy From Auth Service (Don't Rewrite)

| Source | Destination | Notes |
|--------|------------|-------|
| `auth/app/models.py` | `earnings/app/models.py` | All models — ShiftLog, Platform, FileUpload, Screenshot, Verification, etc. |
| `auth/app/database.py` | `earnings/app/database.py` | Exact copy |
| `auth/app/config.py` | Base for `earnings/app/config.py` | Add Cloudinary vars |

---

## Build Order Summary

```
[IMMEDIATELY — no DB needed]
  A1: Scaffolding → service boots on port 8002, /health returns ok

[AFTER DB IS READY]
  A2: Shift CRUD (POST, GET list, GET :id, GET platforms, GET shifts-raw)
      ↑ Tell Hamza when shifts-raw is done — he's blocked on Anomaly /analyze-worker

  A3: CSV/Excel import + Cloudinary archiving

  A4: Screenshot upload + Verification state machine
      (pending → verified/disputed/unverifiable, re-upload resets disputed → pending)

  A5: Worker summary + weekly trends + city median comparison
      ↑ Must finish A5.1 (summary) before starting A6

  A6: Certificate Renderer (port 8006)
      (calls /summary on Earnings Service internally)

[INTEGRATION]
  I1: Confirm /generate returns correct HTML using seeded data
  I5: Full workflow (register → shift → screenshot → verify → trends → certificate)
  I4: Auth checks across all endpoints
  I9: Postman collection (all 15 endpoints)
  I10: README updates with start commands
```

---

## Critical Path Notes

1. **A2 (shifts-raw) is Hamza's blocker** — finish this early and ping him. His Anomaly `/analyze-worker` integration test cannot proceed without it.

2. **A5.1 (summary endpoint) unlocks A6** — don't start the Certificate service until worker summary is returning correct data.

3. **Cloudinary must be configured in `.env`** before A3 and A4 work. Verify with a test upload before importing a full CSV.

4. **Route registration order matters** — in `routes/shifts.py`, register `/shifts/import` and `/shifts/{shift_id}/screenshot` (static prefix first) BEFORE `/shifts/{shift_id}` (param route). Otherwise FastAPI matches "import" as a shift_id.

5. **State machine is final** — `verified` and `unverifiable` have no outbound transitions. Any attempt to change these must return 409.
