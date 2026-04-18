# FairGig — Backend Architecture Document

## Remaining Services: Earnings, Anomaly, Grievance, Analytics, Certificate

---

## 1. Architecture Overview

```
                          ┌─────────────────┐
                          │   React Frontend │
                          └────────┬────────┘
                                   │ HTTP (Bearer JWT)
              ┌────────────────────┼────────────────────────┐
              │                    │                         │
              ▼                    ▼                         ▼
     ┌────────────────┐  ┌────────────────┐       ┌────────────────┐
     │  Auth Service   │  │ Earnings Svc   │       │ Grievance Svc  │
     │  :8001 (FastAPI)│  │ :8002 (FastAPI)│       │ :8004 (Node.js)│
     └───────┬────────┘  └───┬────┬───────┘       └───────┬────────┘
             │                │    │                        │
             │  validates     │    │ fetches                │
             │  tokens        │    │ earnings               │
             │                ▼    ▼                        │
             │         ┌──────────────────┐                 │
             │         │  Anomaly Service  │                 │
             │         │  :8003 (FastAPI)  │                 │
             │         └──────────────────┘                 │
             │                │                             │
             │                │ anomaly                     │
             │                │ results                     │
             │                ▼                             │
             │         ┌──────────────────┐                 │
             │         │ Analytics Service │◄────── grievance stats
             │         │  :8005 (FastAPI)  │                 │
             │         └──────────────────┘                 │
             │                                              │
             │         ┌──────────────────┐                 │
             │         │ Certificate Svc   │                │
             │         │  :8006 (FastAPI)  │                │
             │         └──────────────────┘                │
             │                    │                         │
             ▼                    ▼                         ▼
        ┌─────────────────────────────────────────────────────┐
        │                  PostgreSQL (shared)                 │
        │  shift_logs │ screenshots │ grievances │ anomaly_*  │
        └─────────────────────────────────────────────────────┘
                              │
                        ┌─────┴──────┐
                        │ Cloudinary  │
                        │ (CDN files) │
                        └────────────┘
```

### Inter-Service Communication Rules

Every service follows the same pattern for auth validation. No service stores the JWT secret except Auth Service.

```
Incoming request → Extract Bearer token → HTTP call to Auth Service /api/auth/validate
                                          → Returns {user_id, role, city_zone_id}
                                          → Service enforces role-based access locally
```

All inter-service calls use a shared helper:

```python
# shared pattern for Python services
import httpx
from app.config import get_settings

settings = get_settings()

async def validate_token(token: str) -> dict:
    """Call Auth Service to validate a Bearer token."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.auth_service_url}/api/auth/validate",
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return resp.json()  # {user_id, role, city_zone_id}
```

```javascript
// shared pattern for Node.js (Grievance Service)
const axios = require('axios');

async function validateToken(token) {
    const resp = await axios.get(`${process.env.AUTH_SERVICE_URL}/api/auth/validate`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return resp.data; // {user_id, role, city_zone_id}
}
```

---

## 2. Earnings Service (Port 8002)

### Identity

The core data engine of FairGig. Every other service depends on data this service manages. It owns shift logging, CSV/Excel import with Cloudinary archival, screenshot upload to Cloudinary, and the verification workflow state machine.

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Framework | FastAPI (async) | Consistent with Auth, async file uploads |
| ORM | SQLAlchemy 2.0 (async) | Shared models with Auth |
| File handling | python-multipart + Cloudinary SDK | Multipart uploads, CDN storage |
| CSV parsing | Python csv module + openpyxl | CSV native, Excel via openpyxl |
| HTTP client | httpx (async) | Calling Auth Service for validation |
| Validation | Pydantic v2 | Request/response schemas |

### Tables Owned

`shift_logs`, `screenshots`, `file_uploads`, `platforms` (read), `verifications`

### Endpoints (13 total)

```
POST   /api/earnings/shifts                    — Log a single shift
POST   /api/earnings/shifts/import             — Bulk CSV/Excel import (Cloudinary archived)
GET    /api/earnings/shifts                    — Worker's own shifts (paginated, filterable)
GET    /api/earnings/shifts/:id               — Single shift with screenshot + verification
POST   /api/earnings/shifts/:id/screenshot    — Upload screenshot to Cloudinary
GET    /api/earnings/shifts/:id/screenshot    — Get screenshot Cloudinary URL
GET    /api/earnings/verification-queue        — Verifier's pending review queue
POST   /api/earnings/shifts/:id/verify        — Submit verification decision
GET    /api/earnings/worker/:id/summary       — Earnings summary for date range
GET    /api/earnings/worker/:id/trends        — Weekly/monthly trend data + city median
GET    /api/earnings/platforms                 — List all platforms
GET    /api/earnings/imports                   — Worker's file import history
```

### Internal Architecture

```
services/earnings/
├── app/
│   ├── __init__.py
│   ├── main.py                    # FastAPI app, CORS, router registration
│   ├── config.py                  # Env vars (DB, Cloudinary, Auth URL)
│   ├── database.py                # Async engine, session, get_db dependency
│   ├── models.py                  # SQLAlchemy models (copy from auth or shared package)
│   ├── dependencies.py            # get_current_user, require_role (calls Auth Service)
│   ├── routes/
│   │   ├── shifts.py              # CRUD: create, list, get single, import
│   │   ├── verification.py        # Queue, verify endpoint
│   │   ├── screenshots.py         # Upload, retrieve
│   │   ├── trends.py              # Summary, trends, city median
│   │   └── platforms.py           # List platforms
│   ├── services/
│   │   ├── shift_service.py       # Business logic: create shift, validate math
│   │   ├── import_service.py      # CSV/Excel parsing, validation, batch insert
│   │   ├── cloudinary_service.py  # Upload wrapper for screenshots + files
│   │   └── verification_service.py # State machine logic, discrepancy calc
│   └── schemas/
│       ├── shift.py               # ShiftCreate, ShiftOut, ShiftFilter
│       ├── verification.py        # VerifyRequest, VerificationOut
│       ├── screenshot.py          # ScreenshotOut
│       └── import_schemas.py      # ImportResult
├── requirements.txt
└── README.md
```

### Critical Business Logic

**Shift creation validation:**
```python
# In shift_service.py
def validate_shift_math(gross: Decimal, deductions: Decimal, net: Decimal) -> dict:
    """
    Check net ≈ gross - deductions within 2% tolerance.
    Returns warning dict if slightly off, raises if wildly off.
    """
    expected_net = gross - deductions
    if expected_net == 0:
        tolerance = Decimal("0")
    else:
        tolerance = abs((net - expected_net) / expected_net)

    if tolerance > Decimal("0.10"):  # >10% off — reject
        raise ValueError(f"net_received ({net}) is too far from expected ({expected_net})")
    elif tolerance > Decimal("0.02"):  # 2-10% — accept with warning
        return {"warning": f"net_received differs from expected by {tolerance:.1%}"}
    return {}
```

**Verification state machine:**
```python
# In verification_service.py
VALID_TRANSITIONS = {
    "pending": {"verified", "disputed", "unverifiable"},
    "disputed": {"pending"},    # re-submission resets to pending
    "verified": set(),          # FINAL — no transitions allowed
    "unverifiable": {"pending"},# re-upload can reset
}

def validate_transition(current_status: str, new_status: str) -> None:
    allowed = VALID_TRANSITIONS.get(current_status, set())
    if new_status not in allowed:
        raise ValueError(f"Cannot transition from '{current_status}' to '{new_status}'")
```

**Cloudinary upload wrapper:**
```python
# In cloudinary_service.py
import cloudinary
import cloudinary.uploader
from app.config import get_settings

settings = get_settings()

cloudinary.config(
    cloud_name=settings.cloudinary_cloud_name,
    api_key=settings.cloudinary_api_key,
    api_secret=settings.cloudinary_api_secret,
    secure=True,
)

async def upload_screenshot(file_bytes: bytes, worker_id: str, shift_log_id: str) -> dict:
    result = cloudinary.uploader.upload(
        file_bytes,
        folder=f"fairgig/screenshots/{worker_id}",
        public_id=shift_log_id,
        resource_type="image",
        allowed_formats=["jpg", "png", "jpeg"],
        transformation=[
            {"width": 1200, "crop": "limit"},
            {"quality": "auto:good"},
        ],
    )
    return {
        "cloudinary_public_id": result["public_id"],
        "cloudinary_url": result["secure_url"],
        "width": result.get("width"),
        "height": result.get("height"),
        "format": result.get("format"),
        "file_size_bytes": result.get("bytes"),
    }

async def upload_raw_file(file_bytes: bytes, worker_id: str, upload_id: str, ext: str) -> dict:
    result = cloudinary.uploader.upload(
        file_bytes,
        folder=f"fairgig/imports/{worker_id}",
        public_id=upload_id,
        resource_type="raw",
        allowed_formats=["csv", "xlsx", "xls"],
    )
    return {
        "cloudinary_public_id": result["public_id"],
        "cloudinary_url": result["secure_url"],
        "file_size_bytes": result.get("bytes"),
    }

def get_thumbnail_url(public_id: str, width: int = 300, height: int = 200) -> str:
    """Generate a Cloudinary transformation URL for thumbnails."""
    return cloudinary.CloudinaryImage(public_id).build_url(
        width=width, height=height, crop="thumb", format="auto", quality="auto"
    )
```

**CSV/Excel import service:**
```python
# In import_service.py — key processing logic
import csv
import io
from openpyxl import load_workbook

EXPECTED_COLUMNS = {"platform_name", "date", "hours_worked", "gross_earned",
                    "platform_deductions", "net_received"}

def parse_file(file_bytes: bytes, filename: str) -> list[dict]:
    """Parse CSV or Excel into list of row dicts. Raises on format errors."""
    ext = filename.rsplit(".", 1)[-1].lower()

    if ext == "csv":
        return _parse_csv(file_bytes)
    elif ext in ("xlsx", "xls"):
        return _parse_excel(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: .{ext}")

def _parse_csv(file_bytes: bytes) -> list[dict]:
    text = file_bytes.decode("utf-8-sig")  # handle BOM
    # Detect delimiter
    sniffer = csv.Sniffer()
    dialect = sniffer.sniff(text[:2048])
    reader = csv.DictReader(io.StringIO(text), dialect=dialect)

    # Normalize headers
    headers = {h.strip().lower().replace(" ", "_") for h in reader.fieldnames}
    missing = EXPECTED_COLUMNS - headers
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    return [
        {k.strip().lower().replace(" ", "_"): v.strip() for k, v in row.items()}
        for row in reader
    ]

def _parse_excel(file_bytes: bytes) -> list[dict]:
    wb = load_workbook(io.BytesIO(file_bytes), read_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError("Empty spreadsheet")

    headers = [str(h).strip().lower().replace(" ", "_") for h in rows[0]]
    missing = EXPECTED_COLUMNS - set(headers)
    if missing:
        raise ValueError(f"Missing columns: {missing}")

    return [dict(zip(headers, row)) for row in rows[1:]]

DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%m-%d-%Y", "%d-%m-%Y", "%m/%d/%Y"]

def parse_date(date_str: str) -> date:
    """Try multiple date formats. Raises ValueError if none match."""
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(date_str.strip(), fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: '{date_str}'")
```

**City-wide median comparison (the anonymization query):**
```python
# In trends.py route — the most judge-important query
async def get_city_median_comparison(
    worker_id: uuid.UUID,
    city_zone_id: uuid.UUID,
    period: str,  # 'weekly' or 'monthly'
    months: int,
    db: AsyncSession,
) -> list[dict]:
    """
    Compare worker's earnings against anonymized city-wide median.
    Uses zone_earnings_summary VIEW (k-anonymity enforced at DB level).
    """
    query = text("""
        WITH worker_earnings AS (
            SELECT
                DATE_TRUNC(:period, shift_date) AS period_start,
                SUM(net_received) AS your_net
            FROM shift_logs
            WHERE worker_id = :worker_id
              AND shift_date >= NOW() - INTERVAL ':months months'
            GROUP BY DATE_TRUNC(:period, shift_date)
        ),
        zone_medians AS (
            SELECT
                week AS period_start,
                median_net AS city_median_net
            FROM zone_earnings_summary
            WHERE city_zone_id = :zone_id
        )
        SELECT
            we.period_start,
            we.your_net,
            COALESCE(zm.city_median_net, 0) AS city_median_net,
            CASE
                WHEN zm.city_median_net > 0
                THEN ROUND((we.your_net / zm.city_median_net) * 100, 1)
                ELSE NULL
            END AS percentile_approx
        FROM worker_earnings we
        LEFT JOIN zone_medians zm ON we.period_start = zm.period_start
        ORDER BY we.period_start
    """)
    result = await db.execute(query, {
        "period": period,
        "worker_id": str(worker_id),
        "months": months,
        "zone_id": str(city_zone_id),
    })
    return [dict(row._mapping) for row in result.fetchall()]
```

### Error Handling Strategy

```python
# Standard error responses across all Python services
from fastapi import HTTPException

# 400 — Bad request (malformed input, invalid file)
# 401 — Unauthorized (missing/invalid token)
# 403 — Forbidden (wrong role)
# 404 — Not found (shift, screenshot, worker)
# 409 — Conflict (duplicate entry, already verified)
# 413 — Payload too large (file > 5MB/10MB)
# 422 — Validation error (Pydantic auto-handles, also math validation)

# Custom exception handler for consistency
@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(status_code=422, content={"detail": str(exc)})
```

---

## 3. Anomaly Service (Port 8003)

### Identity

The statistical intelligence engine. This service is **judge-tested** — judges will call `/api/anomaly/detect` directly with crafted payloads to evaluate detection quality. It must handle edge cases gracefully and produce genuinely useful explanations.

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Framework | FastAPI (async) | Mandatory Python FastAPI |
| Statistics | Python stdlib (statistics module) + numpy | Z-score, IQR, rolling averages |
| HTTP client | httpx | Fetching earnings data from Earnings Service |

### Tables Owned

`anomaly_results` (write), reads `shift_logs` via Earnings Service API

### Endpoints (3 total)

```
POST   /api/anomaly/detect             — Core detection (judge-tested, accepts raw payload)
POST   /api/anomaly/analyze-worker     — Fetch real data from Earnings Svc + detect
GET    /api/anomaly/results/:worker_id — Cached anomaly results
```

### Internal Architecture

```
services/anomaly/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── models.py                  # Only AnomalyResult model needed
│   ├── dependencies.py            # Token validation via Auth Service
│   ├── routes/
│   │   └── detect.py              # All 3 endpoints
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── detector.py            # Main orchestrator — calls all methods
│   │   ├── zscore.py              # Z-score on commission rates
│   │   ├── iqr.py                 # IQR on hourly rates
│   │   ├── rolling.py             # Rolling average income comparison
│   │   ├── mom.py                 # Month-over-month total comparison
│   │   ├── sanity.py              # Hours sanity check (>16h, below min wage)
│   │   └── explainer.py           # Human-readable explanation generator
│   └── schemas/
│       ├── detect.py              # DetectRequest, DetectResponse, AnomalyItem
│       └── results.py             # CachedResult
├── requirements.txt
└── README.md
```

### Detection Engine — Complete Implementation Guide

**The `/detect` endpoint is stateless.** It receives an array of earnings, runs all detection methods, and returns results. No database needed for this endpoint. This is what judges test.

```python
# engine/detector.py — the orchestrator

from .zscore import detect_unusual_deductions
from .iqr import detect_rate_outliers
from .rolling import detect_income_drops
from .mom import detect_mom_drops
from .sanity import detect_hours_issues
from .explainer import generate_explanation

def run_all_detections(earnings: list[dict]) -> list[dict]:
    """
    Main entry point. Accepts earnings array, returns anomaly list.
    Each earning dict: {shift_date, platform, gross_earned,
                        platform_deductions, net_received, hours_worked}
    """
    if len(earnings) < 3:
        return []  # Need minimum data for meaningful statistics

    anomalies = []
    anomalies.extend(detect_unusual_deductions(earnings))
    anomalies.extend(detect_rate_outliers(earnings))
    anomalies.extend(detect_income_drops(earnings))
    anomalies.extend(detect_mom_drops(earnings))
    anomalies.extend(detect_hours_issues(earnings))

    # Deduplicate: same shift_date + same type = keep highest severity
    seen = {}
    for a in anomalies:
        key = (a["shift_date"], a["type"])
        if key not in seen or _severity_rank(a["severity"]) > _severity_rank(seen[key]["severity"]):
            seen[key] = a

    # Generate human-readable explanations
    final = list(seen.values())
    for a in final:
        a["explanation"] = generate_explanation(a)

    # Sort: high severity first, then by date
    final.sort(key=lambda x: (-_severity_rank(x["severity"]), x["shift_date"]))
    return final

def _severity_rank(s: str) -> int:
    return {"low": 1, "medium": 2, "high": 3}.get(s, 0)
```

```python
# engine/zscore.py — Z-score detection on commission rates

from statistics import mean, stdev
from collections import defaultdict

def detect_unusual_deductions(earnings: list[dict]) -> list[dict]:
    """
    For each platform, compute mean and std_dev of commission rate.
    Flag shifts where |Z-score| > 2.0.
    """
    by_platform = defaultdict(list)
    for e in earnings:
        if float(e["gross_earned"]) > 0:
            rate = float(e["platform_deductions"]) / float(e["gross_earned"])
            by_platform[e["platform"]].append((e, rate))

    anomalies = []
    for platform, entries in by_platform.items():
        rates = [r for _, r in entries]
        if len(rates) < 3:
            continue  # Need minimum data

        mu = mean(rates)
        sd = stdev(rates) if len(rates) > 1 else 0.001  # Avoid division by zero

        for entry, rate in entries:
            z = (rate - mu) / sd if sd > 0 else 0
            if abs(z) > 2.0:
                severity = "low" if abs(z) < 2.5 else ("medium" if abs(z) < 3.0 else "high")
                anomalies.append({
                    "type": "unusual_deduction",
                    "severity": severity,
                    "shift_date": entry["shift_date"],
                    "platform": platform,
                    "metric": "commission_rate",
                    "expected_range": {"low": round((mu - 2*sd) * 100, 1),
                                       "high": round((mu + 2*sd) * 100, 1)},
                    "actual_value": round(rate * 100, 1),
                    "deviation_score": round(z, 2),
                })
    return anomalies
```

```python
# engine/iqr.py — IQR method on hourly rates

def detect_rate_outliers(earnings: list[dict]) -> list[dict]:
    """
    Compute effective hourly rate per shift.
    Use IQR method: outliers are below Q1-1.5*IQR or above Q3+1.5*IQR.
    """
    valid = []
    for e in earnings:
        hours = float(e["hours_worked"])
        if hours > 0:
            hourly = float(e["net_received"]) / hours
            valid.append((e, hourly))

    if len(valid) < 4:
        return []

    rates = sorted([r for _, r in valid])
    n = len(rates)
    q1 = rates[n // 4]
    q3 = rates[3 * n // 4]
    iqr = q3 - q1

    lower_fence = q1 - 1.5 * iqr
    upper_fence = q3 + 1.5 * iqr

    anomalies = []
    for entry, hourly in valid:
        if hourly < lower_fence or hourly > upper_fence:
            anomalies.append({
                "type": "rate_spike",
                "severity": "medium" if hourly < lower_fence else "low",
                "shift_date": entry["shift_date"],
                "platform": entry["platform"],
                "metric": "effective_hourly_rate",
                "expected_range": {"low": round(lower_fence, 2),
                                   "high": round(upper_fence, 2)},
                "actual_value": round(hourly, 2),
                "deviation_score": round((hourly - q1) / iqr if iqr > 0 else 0, 2),
            })
    return anomalies
```

```python
# engine/rolling.py — Rolling average income drop detection

from datetime import datetime

def detect_income_drops(earnings: list[dict]) -> list[dict]:
    """
    Sort by date. Compute 7-shift rolling average of net_received.
    Flag if current < 70% of rolling average.
    """
    sorted_earnings = sorted(earnings, key=lambda e: e["shift_date"])
    anomalies = []

    for i, e in enumerate(sorted_earnings):
        if i < 7:
            continue  # Need 7 prior shifts for rolling avg

        window = sorted_earnings[max(0, i-7):i]
        avg_net = sum(float(w["net_received"]) for w in window) / len(window)

        current_net = float(e["net_received"])
        if avg_net > 0 and current_net < avg_net * 0.70:
            drop_pct = round((1 - current_net / avg_net) * 100, 1)
            anomalies.append({
                "type": "income_drop",
                "severity": "high" if drop_pct > 40 else "medium",
                "shift_date": e["shift_date"],
                "platform": e["platform"],
                "metric": "net_received_vs_rolling_avg",
                "expected_range": {"low": round(avg_net * 0.70, 2),
                                   "high": round(avg_net * 1.30, 2)},
                "actual_value": current_net,
                "deviation_score": round(-drop_pct / 10, 2),
            })
    return anomalies
```

```python
# engine/mom.py — Month-over-month comparison

from collections import defaultdict

def detect_mom_drops(earnings: list[dict]) -> list[dict]:
    """
    Group by month. If month N total < 80% of month N-1 total, flag.
    """
    monthly = defaultdict(float)
    for e in earnings:
        month_key = e["shift_date"][:7]  # "2026-02"
        monthly[month_key] += float(e["net_received"])

    months = sorted(monthly.keys())
    anomalies = []

    for i in range(1, len(months)):
        prev = monthly[months[i-1]]
        curr = monthly[months[i]]

        if prev > 0 and curr < prev * 0.80:
            drop_pct = round((1 - curr / prev) * 100, 1)
            anomalies.append({
                "type": "mom_drop",
                "severity": "high",
                "shift_date": f"{months[i]}-01",  # first of the month
                "platform": "all",
                "metric": "monthly_net_income",
                "expected_range": {"low": round(prev * 0.80, 2),
                                   "high": round(prev * 1.20, 2)},
                "actual_value": round(curr, 2),
                "deviation_score": round(-drop_pct / 10, 2),
            })
    return anomalies
```

```python
# engine/sanity.py — Hours and minimum wage sanity checks

def detect_hours_issues(earnings: list[dict]) -> list[dict]:
    anomalies = []
    for e in earnings:
        hours = float(e["hours_worked"])
        net = float(e["net_received"])

        # Flag unrealistic hours
        if hours > 16:
            anomalies.append({
                "type": "hours_mismatch",
                "severity": "medium" if hours > 20 else "low",
                "shift_date": e["shift_date"],
                "platform": e["platform"],
                "metric": "hours_worked",
                "expected_range": {"low": 1.0, "high": 16.0},
                "actual_value": hours,
                "deviation_score": round((hours - 10) / 3, 2),
            })

        # Flag if earning below rough minimum wage (PKR 100/hr)
        if hours > 0:
            hourly = net / hours
            if hourly < 100:
                anomalies.append({
                    "type": "rate_spike",
                    "severity": "medium",
                    "shift_date": e["shift_date"],
                    "platform": e["platform"],
                    "metric": "hourly_rate_below_minimum",
                    "expected_range": {"low": 100, "high": 500},
                    "actual_value": round(hourly, 2),
                    "deviation_score": round((hourly - 200) / 50, 2),
                })
    return anomalies
```

```python
# engine/explainer.py — Human-readable explanation templates

TEMPLATES = {
    "unusual_deduction": (
        "Your commission rate on {platform} on {shift_date} was {actual_value}%, "
        "which is outside your normal range of {expected_low}%-{expected_high}%. "
        "This may indicate a platform commission rate change."
    ),
    "income_drop": (
        "Your earnings of PKR {actual_value} on {shift_date} were significantly "
        "below your recent average (PKR {expected_low} - {expected_high}). "
        "This could reflect fewer trips or reduced demand in your area."
    ),
    "rate_spike": (
        "Your effective hourly rate on {platform} on {shift_date} was PKR {actual_value}/hr, "
        "outside the typical range of PKR {expected_low}-{expected_high}/hr."
    ),
    "mom_drop": (
        "Your total income in {shift_date} dropped to PKR {actual_value}, "
        "below the expected range of PKR {expected_low}-{expected_high} based on "
        "the prior month. This represents a significant month-over-month decline."
    ),
    "hours_mismatch": (
        "A shift of {actual_value} hours on {shift_date} on {platform} seems unusually long. "
        "The expected range is {expected_low}-{expected_high} hours. Please verify this entry."
    ),
}

def generate_explanation(anomaly: dict) -> str:
    template = TEMPLATES.get(anomaly["type"], "Anomaly detected on {shift_date}.")
    return template.format(
        platform=anomaly.get("platform", "unknown"),
        shift_date=anomaly["shift_date"],
        actual_value=anomaly["actual_value"],
        expected_low=anomaly["expected_range"]["low"],
        expected_high=anomaly["expected_range"]["high"],
    )
```

### Edge Cases to Handle (Judges Will Test These)

| Edge Case | Expected Behavior |
|-----------|-------------------|
| Empty earnings array | Return `{anomalies_found: 0, anomalies: [], summary: "Insufficient data"}` |
| Only 1-2 entries | Return empty — not enough data for statistics |
| All identical values | std_dev = 0, Z-score undefined → skip Z-score, IQR still works if range is 0 (no outliers) |
| Single platform | Works normally — per-platform grouping still applies |
| All same date | Rolling average skipped (need temporal spread), MoM skipped, but Z-score and IQR still work |
| Negative net_received | Shouldn't happen (DB constraint), but handle gracefully — treat as 0 |
| Zero hours_worked | Skip hourly rate calculation, flag as sanity check |
| Very large numbers | DECIMAL handles it — no floating point issues |

---

## 4. Grievance Service (Port 8004)

### Identity

The community voice of FairGig. This is the **mandatory Node.js service**. Workers post complaints, advocates moderate and cluster them. The clustering feature and full-text search are what make this more than basic CRUD.

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Framework | Express.js | Mandatory Node.js |
| ORM | Prisma | Introspects existing PostgreSQL schema, typed client |
| Validation | Joi or Zod | Request validation |
| Auth | axios | HTTP calls to Auth Service |
| Search | PostgreSQL tsvector (via Prisma raw queries) | No extra infrastructure |

### Tables Owned

`grievances`, `grievance_tags`

### Endpoints (9 total)

```
POST   /api/grievances                  — Post a new complaint (auto-tagged)
GET    /api/grievances                  — List/search complaints (paginated)
GET    /api/grievances/:id              — Single grievance detail
PATCH  /api/grievances/:id/status       — Update status (advocate only)
POST   /api/grievances/:id/tags         — Add tags (advocate only)
DELETE /api/grievances/:id/tags/:tag    — Remove tag (advocate only)
GET    /api/grievances/clusters         — Cluster similar complaints (advocate)
GET    /api/grievances/stats            — Dashboard statistics (advocate)
DELETE /api/grievances/:id              — Delete grievance
```

### Internal Architecture

```
services/grievance/
├── src/
│   ├── index.js                   # Express app entry point
│   ├── config.js                  # Env vars
│   ├── middleware/
│   │   ├── auth.js                # Validates token via Auth Service
│   │   └── errorHandler.js        # Global error handler
│   ├── routes/
│   │   ├── grievances.js          # CRUD + search + clusters + stats
│   │   └── tags.js                # Tag management
│   ├── services/
│   │   ├── grievanceService.js    # Business logic
│   │   └── autoTagger.js          # Keyword-based auto-tagging
│   └── validators/
│       └── grievanceValidator.js   # Joi/Zod schemas
├── prisma/
│   └── schema.prisma              # Auto-generated via `npx prisma db pull`
├── package.json
└── README.md
```

### Auto-Tagging Logic

```javascript
// src/services/autoTagger.js

const TAG_KEYWORDS = {
    commission_increase: ['commission', 'percentage', 'cut', 'increased', 'raised', 'hiked'],
    account_suspended: ['deactivated', 'banned', 'suspended', 'blocked', 'locked'],
    payment_delay: ['payment', 'unpaid', 'settlement', 'not received', 'delayed'],
    rating_manipulation: ['rating', 'star', 'review', 'unfair rating'],
    safety_concern: ['safety', 'dangerous', 'threat', 'emergency', 'night'],
    app_issue: ['app', 'crash', 'bug', 'error', 'glitch'],
};

function autoTag(description) {
    const lower = description.toLowerCase();
    const tags = new Set();

    for (const [tag, keywords] of Object.entries(TAG_KEYWORDS)) {
        for (const keyword of keywords) {
            if (lower.includes(keyword)) {
                tags.add(tag);
                break; // One match per tag is enough
            }
        }
    }

    return Array.from(tags).slice(0, 3); // Max 3 auto-tags
}

module.exports = { autoTag };
```

### Clustering Query (Raw SQL via Prisma)

```javascript
// In grievanceService.js
async function getClusters(days = 30, minClusterSize = 3) {
    const clusters = await prisma.$queryRaw`
        SELECT
            p.name AS platform_name,
            g.category,
            COUNT(*) AS complaint_count,
            MIN(g.created_at) AS earliest,
            MAX(g.created_at) AS latest,
            COUNT(*) FILTER (WHERE g.status = 'escalated') AS escalated_count,
            ARRAY_AGG(DISTINCT gt.tag) FILTER (WHERE gt.tag IS NOT NULL) AS common_tags,
            ARRAY(
                SELECT LEFT(sub.description, 100)
                FROM grievances sub
                WHERE sub.platform_id = g.platform_id AND sub.category = g.category
                  AND sub.created_at >= NOW() - INTERVAL '1 day' * ${days}
                ORDER BY sub.created_at DESC
                LIMIT 3
            ) AS sample_descriptions
        FROM grievances g
        JOIN platforms p ON g.platform_id = p.id
        LEFT JOIN grievance_tags gt ON g.id = gt.grievance_id
        WHERE g.created_at >= NOW() - INTERVAL '1 day' * ${days}
        GROUP BY p.name, g.category, g.platform_id
        HAVING COUNT(*) >= ${minClusterSize}
        ORDER BY COUNT(*) DESC
    `;
    return clusters;
}
```

### Prisma Setup Steps

```bash
# After Shaheer finishes DB setup:
cd services/grievance
npm init -y
npm install express prisma @prisma/client axios joi cors dotenv
npx prisma init
# Edit .env with DATABASE_URL (use postgresql:// not asyncpg)
npx prisma db pull    # Introspects existing tables → generates schema.prisma
npx prisma generate   # Creates typed Prisma client
```

---

## 5. Analytics Service (Port 8005)

### Identity

The advocate's intelligence dashboard. All queries use the anonymized `zone_earnings_summary` view or aggregated queries. This service never exposes individual worker data to advocate users — except vulnerability flags (which show `display_name` only, never contact info).

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Framework | FastAPI (async) | Consistent with other Python services |
| Query style | Raw SQL via SQLAlchemy `text()` | Complex aggregates with window functions are cleaner in raw SQL than ORM |
| Caching | In-memory dict with TTL | Dashboard KPIs don't need real-time freshness; 5-min cache reduces DB load |

### Tables Read (no tables owned)

`zone_earnings_summary` (view), `monthly_worker_totals` (materialized view), `shift_logs`, `users`, `anomaly_results`, `grievances`

### Endpoints (5 total)

```
GET    /api/analytics/commission-trends     — Commission rate trends by platform
GET    /api/analytics/income-distribution   — Income by city zone (P25, P50, P75)
GET    /api/analytics/vulnerability-flags   — Workers with >20% MoM income drops
GET    /api/analytics/dashboard-summary     — All KPIs in one call (parallelized)
GET    /api/analytics/platform-comparison   — Fairness score comparison
```

### Internal Architecture

```
services/analytics/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py
│   ├── dependencies.py
│   ├── routes/
│   │   ├── commission.py
│   │   ├── income.py
│   │   ├── vulnerability.py
│   │   ├── dashboard.py
│   │   └── comparison.py
│   ├── queries/                    # Raw SQL as Python strings (or .sql files)
│   │   ├── commission_trends.py
│   │   ├── income_distribution.py
│   │   ├── vulnerability_flags.py
│   │   ├── dashboard_kpis.py
│   │   └── platform_comparison.py
│   └── schemas/
│       └── analytics.py
├── requirements.txt
└── README.md
```

### Dashboard Summary — Parallel Query Execution

```python
# routes/dashboard.py
import asyncio

@router.get("/api/analytics/dashboard-summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    _user = Depends(require_role("advocate")),
):
    """Run all KPI queries in parallel using asyncio.gather."""
    (
        active_workers,
        shift_counts,
        avg_commission,
        vulnerable_count,
        open_grievances,
        top_category,
        platform_count,
    ) = await asyncio.gather(
        _count_active_workers(db),
        _count_shifts(db),
        _avg_commission(db),
        _count_vulnerable(db),
        _count_open_grievances(db),
        _top_complaint_category(db),
        _count_platforms(db),
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
```

### Vulnerability Flags — The Window Function Query

```python
# queries/vulnerability_flags.py

VULNERABILITY_QUERY = """
    WITH monthly AS (
        SELECT
            worker_id,
            month,
            total_net,
            LAG(total_net) OVER (PARTITION BY worker_id ORDER BY month) AS prev_month_net
        FROM monthly_worker_totals
    )
    SELECT
        m.worker_id,
        u.display_name,
        cz.name AS city_zone,
        m.prev_month_net AS previous_month_income,
        m.total_net AS current_month_income,
        ROUND(((m.prev_month_net - m.total_net) / NULLIF(m.prev_month_net, 0)) * 100, 1)
            AS drop_percentage,
        EXISTS(
            SELECT 1 FROM anomaly_results ar
            WHERE ar.worker_id = m.worker_id
              AND ar.severity = 'high'
              AND ar.detected_at >= NOW() - INTERVAL '30 days'
        ) AS has_recent_anomalies
    FROM monthly m
    JOIN users u ON m.worker_id = u.id
    LEFT JOIN city_zones cz ON u.city_zone_id = cz.id
    WHERE m.prev_month_net IS NOT NULL
      AND m.prev_month_net > 0
      AND ((m.prev_month_net - m.total_net) / m.prev_month_net) > :threshold
      AND m.month = (SELECT MAX(month) FROM monthly_worker_totals)
    ORDER BY drop_percentage DESC
"""
```

### Fairness Score — Composite Scoring

```python
# queries/platform_comparison.py

PLATFORM_COMPARISON_QUERY = """
    WITH platform_stats AS (
        SELECT
            p.id AS platform_id,
            p.name AS platform_name,
            AVG(sl.platform_deductions / NULLIF(sl.gross_earned, 0)) * 100 AS avg_commission,
            AVG(sl.net_received / NULLIF(sl.hours_worked, 0)) AS avg_hourly,
            COUNT(DISTINCT sl.worker_id) AS worker_count
        FROM shift_logs sl
        JOIN platforms p ON sl.platform_id = p.id
        WHERE sl.shift_date >= NOW() - INTERVAL ':months months'
        GROUP BY p.id, p.name
    ),
    platform_complaints AS (
        SELECT
            platform_id,
            COUNT(*) AS complaint_count,
            COUNT(*) FILTER (WHERE category = 'deactivation') AS deactivation_count
        FROM grievances
        WHERE created_at >= NOW() - INTERVAL ':months months'
        GROUP BY platform_id
    )
    SELECT
        ps.platform_name,
        ROUND(ps.avg_commission, 2) AS avg_commission_rate,
        COALESCE(pc.complaint_count, 0) AS complaint_count,
        ROUND(ps.avg_hourly, 2) AS avg_hourly_rate,
        ps.worker_count,
        COALESCE(pc.deactivation_count, 0) AS deactivation_complaints,
        -- Fairness score: lower commission + fewer complaints + higher hourly = better
        ROUND(
            (1.0 - LEAST(ps.avg_commission / 100.0, 1.0)) * 40 +
            GREATEST(0, 30 - COALESCE(pc.complaint_count, 0)) +
            LEAST(ps.avg_hourly / 20.0, 1.0) * 30
        , 1) AS fairness_score
    FROM platform_stats ps
    LEFT JOIN platform_complaints pc ON ps.platform_id = pc.platform_id
    ORDER BY fairness_score DESC
"""
```

---

## 6. Certificate Renderer (Port 8006)

### Identity

The smallest and simplest service. Completely stateless — no database tables of its own. Calls the Earnings Service internally to fetch verified earnings data, then renders a print-friendly HTML page using Jinja2 templates.

### Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Framework | FastAPI | Consistent with other Python services |
| Templating | Jinja2 | Built into FastAPI, clean HTML templates |
| HTTP client | httpx | Fetching data from Earnings Service |

### Endpoints (2 total)

```
GET    /api/certificate/preview    — JSON preview of certificate data
GET    /api/certificate/generate   — Full HTML page (print-friendly, @media print CSS)
```

### Internal Architecture

```
services/certificate/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── dependencies.py
│   ├── routes/
│   │   └── certificate.py
│   └── templates/
│       └── certificate.html       # Jinja2 template with @media print CSS
├── requirements.txt
└── README.md
```

### Certificate Template Requirements

```html
<!-- Key CSS for print-friendliness -->
<style>
    @media print {
        body { margin: 0; padding: 20mm; font-size: 12pt; }
        .no-print { display: none; }
        table { page-break-inside: avoid; }
        @page { size: A4; margin: 15mm; }
    }
    @media screen {
        body { max-width: 800px; margin: 0 auto; padding: 40px; }
        .print-btn { position: fixed; top: 20px; right: 20px; }
    }
</style>
```

The template must include:
- Certificate number (UUID short hash, first 8 chars)
- Worker display name and city zone (no email/phone)
- Date range covered
- Summary table: total gross, deductions, net, hours, effective hourly rate
- Per-platform breakdown table
- Verification rate: "X of Y shifts verified (Z%)"
- Honesty disclaimer: "This certificate reflects self-reported earnings, verified where possible. FairGig does not guarantee accuracy."
- Generated timestamp
- A "Print" button visible on screen, hidden on print

---

## 7. Cross-Cutting Concerns

### Error Handling (All Services)

```python
# Standard error response format across all services
{
    "detail": "Human-readable error message",
    "code": "SHIFT_NOT_FOUND",        # Optional machine-readable code
    "field": "gross_earned"            # Optional field reference for validation
}

# HTTP status code usage:
# 200 — Success
# 201 — Created (POST that creates a resource)
# 400 — Bad request (malformed input, invalid file format)
# 401 — Unauthorized (missing or invalid token)
# 403 — Forbidden (valid token but wrong role)
# 404 — Resource not found
# 409 — Conflict (duplicate entry, already verified)
# 413 — Payload too large (file exceeds limit)
# 422 — Validation error (Pydantic rejects input, math doesn't check out)
# 500 — Internal server error (catch-all, log it)
```

### Validation Layers

```
Layer 1: Pydantic/Joi schemas     — Type checking, required fields, format validation
Layer 2: Business logic           — Math validation (net ≈ gross - deductions), state machine
Layer 3: Database constraints     — CHECK constraints, UNIQUE constraints, FK constraints
```

Each layer catches different kinds of errors. Never rely on only one layer.

### Security

| Concern | Implementation |
|---------|---------------|
| Auth | JWT validation via Auth Service on every request |
| Role enforcement | `require_role()` dependency/middleware checks role from token |
| SQL injection | Parameterized queries everywhere — SQLAlchemy `text()` with `:param`, Prisma parameterized |
| XSS | Grievance descriptions sanitized (strip HTML tags) before storage |
| File upload | MIME type validation + file size limits + Cloudinary's own validation |
| Data privacy | Workers see only own data; advocates see aggregates via views; anonymization via k-anonymity |
| CORS | Allow only `http://localhost:5173` (Vite dev) and production domain |

### Performance Strategies

| Strategy | Where | Impact |
|----------|-------|--------|
| Async IO | All Python services (asyncpg) | Non-blocking DB queries |
| Parallel queries | Analytics dashboard (`asyncio.gather`) | Dashboard loads in 1 round-trip |
| Partial indexes | `shift_logs WHERE status='pending'` | Verifier queue queries only scan pending shifts |
| Materialized view | `monthly_worker_totals` | MoM vulnerability check avoids full table scan |
| Cloudinary CDN | Screenshots | Images served from edge, not through our backend |
| Pagination | Every list endpoint | Never return unbounded result sets |
| Connection pooling | SQLAlchemy `pool_size=10, max_overflow=20` | Prevents connection exhaustion |
| Batch inserts | CSV import (`executemany`) | 500 rows per batch instead of 1-by-1 |