# FairGig — Project Requirements Document (PRD)
## SOFTEC 2026 Web Dev Competition
### Version 2.0 — Updated with all architecture decisions, validation layer, and implementation details

---

## 1. Problem Statement

Pakistan has millions of gig workers — ride-hailing drivers, food delivery riders, freelance designers, domestic workers — who earn income across multiple platforms with no unified record, no payslip, and no protection when platforms change commission rates overnight or deactivate accounts without explanation.

These workers cannot prove their income to landlords, banks, or family. They have no visibility into whether the platform is fairly calculating their earnings. They have no community to collectively surface grievances or share rate intelligence.

**FairGig** empowers gig workers to log, verify, and understand their earnings across platforms, while giving labour advocates a dashboard to spot systemic unfairness at scale.

The platform must work for a rider who is not tech-savvy, be honest about what it can and cannot verify, and surface patterns that an individual worker would never see alone.

---

## 2. User Personas

| Persona | Role Key | Core Actions |
|---------|----------|-------------|
| **Gig Worker** | `worker` | Logs shifts, uploads screenshots for verification, views income analytics and trends, generates a shareable income certificate, posts grievances |
| **Verifier** | `verifier` | Reviews uploaded earnings screenshots in a FIFO queue, confirms / disputes / marks unverifiable |
| **Advocate / Analyst** | `advocate` | Monitors aggregate trends — commission rate changes, income volatility by zone, deactivation complaint clusters, vulnerability flags |
| **Worker Community** | `worker` | Anonymous bulletin board for rate intel and complaints, moderated by advocates |

---

## 3. Tech Stack

### 3.1 Backend Services

| Service | Framework | Port | Role |
|---------|-----------|------|------|
| Auth Service | Python FastAPI | 8001 | JWT auth, role management, token validation for all other services |
| Earnings Service | Python FastAPI | 8002 | Shift CRUD, CSV/Excel import (Cloudinary archived), screenshot upload (Cloudinary), verification workflow |
| Anomaly Service | Python FastAPI **(mandatory)** | 8003 | Statistical anomaly detection — Z-score, IQR, rolling avg, MoM. **Judge-tested endpoint.** |
| Grievance Service | Node.js + Express **(mandatory)** | 8004 | Complaint board, tagging, clustering, escalation workflow |
| Analytics Service | Python FastAPI | 8005 | Aggregate KPIs for advocate dashboard, anonymized queries via DB views |
| Certificate Renderer | Python FastAPI | 8006 | Stateless Jinja2 HTML certificate generation — no DB of its own |

### 3.2 Database

**Choice: PostgreSQL 16**

| Reason | Detail |
|--------|--------|
| Relational integrity | FK constraints catch data bugs at DB level, not runtime |
| Financial precision | `DECIMAL(12,2)` — no floating point errors on money fields |
| Analytics queries | Native `PERCENTILE_CONT`, `LAG`, `PERCENT_RANK`, `DATE_TRUNC`, CTEs, window functions |
| Anonymization | Row-Level Security (RLS) + views with `HAVING COUNT(*) >= 5` enforce k-anonymity at DB layer |
| Full-text search | `tsvector` + `plainto_tsquery` for grievance board — no extra service needed |
| Concurrent writes | MVCC handles concurrent CSV imports and shift logging without explicit locking |

### 3.3 ORM Strategy

| Ecosystem | ORM | Justification |
|-----------|-----|---------------|
| Python (5 services) | **SQLAlchemy 2.0 + Alembic** | Modern `Mapped[]` / `mapped_column()` syntax. Alembic is the single source of truth for all migrations |
| Node.js (Grievance) | **Prisma** | Runs `npx prisma db pull` to introspect existing PostgreSQL schema. No duplicate definitions. TypeScript-typed client. Cleaner than TypeORM. |

**Migration flow (one-time setup after DB is ready):**
```
1. Shaheer runs: alembic upgrade head   → all 10 tables + 2 views + RLS created
2. Grievance:    npx prisma db pull      → generates schema.prisma from existing tables
3. Grievance:    npx prisma generate     → typed Prisma client ready
```

**SQLAlchemy model style — 2.0 syntax only (never old 1.x style):**
```python
class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
```

**Analytics queries:** Complex aggregates written as raw SQL via `SQLAlchemy text()` — ORMs make these harder, not easier.

**Seed script:** Uses sync SQLAlchemy (psycopg2) for simplicity. Services use async (asyncpg).

### 3.4 File Storage

**Choice: Cloudinary** — managed CDN, no infrastructure to manage.

**Used for:**
- **Screenshot uploads** — worker earnings screenshots (PNG/JPG, max 5 MB)
- **CSV/Excel file uploads** — original import files archived for audit trail (max 10 MB)

**Upload flow — server-side only, no direct browser uploads:**
```
User → Browser → FastAPI Earnings Service
  → validate (extension + magic bytes / MIME + size)
  → Cloudinary Upload API
  → Returns {secure_url, public_id, width, height, format}
  → Store metadata in DB
```

**Cloudinary folder structure:**
```
fairgig/
├── screenshots/{worker_id}/{shift_log_id}.jpg    resource_type: image
└── imports/{worker_id}/{import_id}.csv           resource_type: raw
```

**Screenshot upload config:**
```python
cloudinary.uploader.upload(
    file_bytes,
    folder=f"fairgig/screenshots/{worker_id}",
    public_id=shift_log_id,
    resource_type="image",
    allowed_formats=["jpg", "png", "jpeg"],
    transformation=[{"width": 1200, "crop": "limit"}, {"quality": "auto:good"}],
)
```

**CSV/Excel upload config:**
```python
cloudinary.uploader.upload(
    file_bytes,
    folder=f"fairgig/imports/{worker_id}",
    public_id=import_id,
    resource_type="raw",
    allowed_formats=["csv", "xlsx", "xls"],
)
```

**Thumbnail URL generation for verifier queue:**
```python
cloudinary.CloudinaryImage(public_id).build_url(
    width=300, height=200, crop="thumb", format="auto", quality="auto"
)
```

Always build URLs from `public_id` — never hardcode Cloudinary URLs.

### 3.5 Frontend

| Component | Choice |
|-----------|--------|
| Framework | **React** (Vite) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Server state | TanStack Query (React Query) |
| UI state | Zustand |
| HTTP client | Axios with JWT refresh interceptors |
| Routing | React Router v6 |

**Design system:** Dark Editorial Precision — `#0D0D0B` ink, `#D4900E` amber accent, Fraunces serif for display, DM Sans for UI, JetBrains Mono for financial data only.

### 3.6 Auth

| Component | Choice | Detail |
|-----------|--------|--------|
| Token type | **JWT** (PyJWT) | Stateless, inter-service validation via Auth Service |
| Access token expiry | 15 minutes | Short-lived |
| Refresh token expiry | 7 days | Client-side storage |
| Password hashing | bcrypt, 12 salt rounds | Industry standard |
| Inter-service auth | `GET /api/auth/validate` | All services call Auth Service — JWT secret never shared |

---

## 4. Core Functional Requirements

### 4.1 Earnings Logger

- Workers log: platform, date, hours worked, gross earned, platform deductions, net received
- Manual form entry + bulk CSV/Excel import
- Original files archived on Cloudinary (audit trail)
- Math validation: `net_received ≈ gross_earned - platform_deductions` (10% hard reject, 2% warning)
- Deduplication: UNIQUE constraint on `(worker_id, platform_id, shift_date, gross_earned)`

### 4.2 Screenshot Verification Flow

- Worker uploads PNG/JPG screenshot (max 5 MB), validated by magic bytes (not just MIME)
- Uploaded to Cloudinary, stored as `cloudinary_public_id` + `cloudinary_url`
- Verifier reviews in FIFO queue (oldest first), with Cloudinary thumbnail URLs
- Verifier decisions: **confirm**, **flag discrepancy** (requires notes + verifier's reading), **mark unverifiable** (requires notes)
- Discrepancy = worker claimed vs verifier read values

**State machine (strictly enforced):**
```
pending → verified      (confirmed — FINAL, no further transitions)
pending → disputed      (verifier flags discrepancy)
pending → unverifiable  (verifier cannot read screenshot)
disputed → pending      (worker re-uploads — resets for re-review)
unverifiable → pending  (worker re-uploads)
```

### 4.3 Income Analytics Dashboard (Worker View)

- Weekly/monthly earnings trends (line chart)
- Effective hourly rate over time
- Platform commission rate tracker (per-platform line chart)
- City-wide median comparison — uses **real aggregated data from seeded records** (NOT hardcoded values)
- k-anonymity: zones with fewer than 5 workers excluded from aggregates
- Percentile rank: "You earned more than X% of workers in your zone"

### 4.4 Shareable Income Certificate

- Worker selects a date range
- Certificate Renderer calls Earnings Service `/summary` endpoint internally
- Shows only verified earnings (configurable)
- Content: total gross, deductions, net, hours, effective hourly rate, per-platform breakdown, verification rate progress bar
- Certificate number: first 8 chars of UUID hash
- Honest disclaimer: "This certificate reflects self-reported earnings, verified where possible. FairGig does not guarantee accuracy."
- Print-optimized: `@media print` CSS, A4 sizing, no background colors, diagonal "FAIRGIG" watermark visible only on print, signature line
- **Always renders on parchment background** regardless of app dark/light mode toggle

### 4.5 Grievance Board

- Workers post: platform, category, description (min 10 chars)
- Categories: `commission_change`, `deactivation`, `payment_delay`, `unfair_rating`, `safety`, `other`
- Anonymous by default (`is_anonymous = true`)
- Auto-tagging: keywords in description auto-generate initial tags
- Advocates can: add/remove tags, update status, view complaint clusters
- Full-text search via PostgreSQL `tsvector`
- Status: `open → escalated → resolved` (no backwards transitions)

**Clustering:** Groups complaints by `(platform_id, category, time_window)` with `HAVING COUNT(*) >= min_cluster_size`

### 4.6 Advocate Analytics Panel

- Commission rate trends by platform over time (from `zone_earnings_summary` view — anonymized)
- Income distribution by city zone (P25, P50, P75) — min 5 workers per group
- Top complaint categories this week
- Vulnerability flags: workers with >20% MoM income drop — shows `display_name` only, never email/phone
- Platform fairness score: composite of inverse commission rate (×0.4) + inverse complaint rate (×0.3) + hourly rate percentile (×0.3)
- All KPIs loaded in one API call via `asyncio.gather` (parallel queries)

### 4.7 Anomaly Detection Service

Accepts `earnings` array, runs all detection methods, returns anomaly list sorted by severity.

**Detection methods:**

| Method | Logic | Severity Threshold |
|--------|-------|-------------------|
| Z-score (commission) | Per-platform commission rate std deviation | `\|Z\| > 2.0` = low, `> 2.5` = medium, `> 3.0` = high |
| IQR (hourly rate) | Effective hourly rate outliers | Beyond `Q1 - 1.5×IQR` or `Q3 + 1.5×IQR` |
| Rolling average | 7-shift rolling net income comparison | Current < 70% of rolling avg = medium/high |
| Month-over-month | Monthly totals comparison | >20% drop = high |
| Sanity check | Hours per shift | >16 hours = low/medium |

**Edge cases the `/detect` endpoint must handle gracefully:**

| Input | Expected Output |
|-------|----------------|
| Empty array | `{anomalies_found: 0, anomalies: [], summary: "Insufficient data."}` |
| Fewer than 3 entries | Return empty — not enough for statistics |
| All identical values | No anomalies — std_dev ≈ 0, IQR = 0 |
| Single platform | Works — per-platform grouping still applies |
| Zero `hours_worked` | Skip hourly rate calculation, flag as sanity issue |
| String dates | Try `%Y-%m-%d`, `%d/%m/%Y`, `%m-%d-%Y` before failing |
| Negative `net_received` | Treat as 0 |
| > 5,000 entries | Reject with 422 |

---

## 5. Service Architecture

### 5.1 Inter-Service Communication

```
All services:          Bearer token → GET /api/auth/validate → {user_id, role, city_zone_id}
Anomaly /analyze:      POST → Earnings GET /api/earnings/worker/{id}/shifts
Certificate /generate: POST → Earnings GET /api/earnings/worker/{id}/summary
Analytics dashboard:   asyncio.gather([commission, income, vulnerability, grievance_stats])
```

No message queue — direct HTTP via `httpx` (async Python) and `axios` (Node.js).

### 5.2 Token Validation Pattern

**Python services:**
```python
async def validate_token(token: str) -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.auth_service_url}/api/auth/validate",
            headers={"Authorization": f"Bearer {token}"}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return resp.json()   # {user_id, role, city_zone_id}
```

**Node.js Grievance Service:**
```javascript
async function validateToken(token) {
  const resp = await axios.get(`${AUTH_SERVICE_URL}/api/auth/validate`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return resp.data;
}
```

### 5.3 Service Independence

Each service independently runnable with a single command. No Docker required.

```bash
# All Python services
uvicorn app.main:app --port 800X --reload

# Node.js Grievance Service
npm start   # or: node src/index.js

# Seed script
cd seed && python seed.py
```

---

## 6. Validation Architecture

### 6.1 Library Decisions

**Zod cannot be used in Python.** It is a TypeScript-only library.

| Service | Language | Library | Integration |
|---------|----------|---------|-------------|
| Auth | Python | **Pydantic v2** (built-in) | FastAPI native — schemas = validators + OpenAPI docs |
| Earnings | Python | **Pydantic v2** (built-in) | Same |
| Anomaly | Python | **Pydantic v2** (built-in) | Strictest — judge-tested endpoint |
| Analytics | Python | **Pydantic v2** (built-in) | Query param bounds via `Field()` |
| Certificate | Python | **Pydantic v2** (built-in) | Simple query params |
| Grievance | Node.js | **Zod** | Express middleware via `validate()` wrapper |

### 6.2 Shared Pydantic Types

Located in `shared/validators/common.py`, imported by all Python services:

| Type | Constraint | Used For |
|------|-----------|---------|
| `CleanStr` | Strip whitespace + injection check | Names, platform names |
| `PositiveMoney` | `Decimal > 0, max_digits=12, decimal_places=2` | gross_earned |
| `NonNegativeMoney` | `Decimal >= 0, max_digits=12, decimal_places=2` | deductions, net |
| `HoursWorked` | `Decimal > 0, <= 24` | hours per shift |
| `ShiftDate` | `date`, cannot be in the future | shift_date |
| `PageNumber` | `int >= 1` | page param |
| `PageLimit` | `int, 1–100` | limit param |

### 6.3 Standardised Error Response

Every validation error across all 6 services returns this structure:

```json
{
  "error": "validation_error",
  "message": "One or more fields failed validation.",
  "details": [
    { "field": "gross_earned", "message": "must be greater than 0" },
    { "field": "shift_date",   "message": "shift date cannot be in the future" }
  ]
}
```

Other error codes: `conflict` (409), `not_found` (404), `forbidden` (403), `unauthorized` (401), `file_rejected` (400), `file_too_large` (413), `internal_error` (500).

### 6.4 Exception Handler Registration

Add to every Python service `main.py`:
```python
from shared.validators.error_handlers import register_exception_handlers
app = FastAPI(title="FairGig X Service")
register_exception_handlers(app)  # replaces FastAPI default 422 with clean errors
```

Add to Grievance Service `src/index.js` (last middleware):
```javascript
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);
```

### 6.5 UUID Path Parameters

FastAPI validates UUID format automatically when type-hinted. Always use `uuid.UUID`, never `str`:

```python
@router.get("/shifts/{shift_id}")
async def get_shift(shift_id: uuid.UUID, ...):    # FastAPI rejects non-UUIDs with 422
    ...
```

### 6.6 Query Parameter Validation

```python
@router.get("/shifts")
async def list_shifts(params: Annotated[ShiftListParams, Depends()], ...):
    ...

class ShiftListParams(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    verification_status: Optional[str] = None
    sort_by: Literal["date", "gross_earned"] = "date"
    sort_order: Literal["asc", "desc"] = "desc"
```

---

## 7. CSV Import Validation Pipeline

### 7.1 Reject vs Partial Import Strategy

| Condition | Action | HTTP Status |
|-----------|--------|-------------|
| Wrong file extension | Reject whole file | 400 |
| File is empty | Reject whole file | 400 |
| Missing required columns | Reject whole file | 400 |
| Duplicate column headers | Reject whole file | 400 |
| > 5,000 rows | Reject whole file | 400 |
| > 10 MB | Reject whole file | 413 |
| Row-level errors | Partial import — insert valid rows | 200 |

### 7.2 All Validation Checks

**File-level (runs before any row parsing):**
1. Extension: `.csv`, `.xlsx`, `.xls` only
2. MIME type: accepted CSV/Excel types
3. Size: ≤ 10 MB
4. Encoding: UTF-8-BOM → UTF-8 → Latin-1 → chardet auto-detect
5. Delimiter: `csv.Sniffer` (comma, semicolon, tab, pipe)
6. Header row: must exist
7. Required columns: all 6 present (case-insensitive, whitespace-normalised)
8. Duplicate headers: rejected
9. Row count: ≤ 5,000
10. Non-empty data rows: at least 1

**Row-level (collected, partial import continues):**
11. Row length: fewer columns than required → corrupted row
12. Null-like values: `""`, `N/A`, `null`, `-`, `–`, `?`, `#N/A`, etc.
13. Whitespace-only cells
14. Formula injection: values starting with `=`, `+`, `-`, `@` rejected
15. `platform_name`: non-empty, ≤ 100 chars, no injection
16. `date`: multi-format parsing (`%Y-%m-%d`, `%d/%m/%Y`, `%m/%d/%Y`), no future dates
17. `hours_worked`: decimal > 0, ≤ 24
18. `gross_earned`: decimal > 0
19. `platform_deductions`: decimal ≥ 0, cannot exceed gross_earned
20. `net_received`: decimal ≥ 0
21. Cross-field math: `net_received ≈ gross_earned - platform_deductions` (10% tolerance)
22. Within-file duplicate: `(platform_name, date, gross_earned)` uniqueness

**Post-parsing:**
23. Platform name → UUID lookup in `platforms` table
24. Against-DB duplicate detection via UNIQUE constraint
25. Batch INSERT in chunks of 500

### 7.3 Decimal Format Handling

The parser normalises all of these to `Decimal`:
- `1200.50` — standard
- `1,200.50` — US thousands separator
- `1.200,50` — European format (auto-detected)
- `PKR 1200` — currency prefix stripped
- `1\u00a0200` — non-breaking space stripped

### 7.4 Required CSV Columns

```
platform_name, date, hours_worked, gross_earned, platform_deductions, net_received
```

Column names are case-insensitive and whitespace-normalised (`Platform Name` = `platform_name`).

---

## 8. Data Seeding Strategy

Seed script (`seed/seed.py`) — idempotent, truncates all tables first:

```bash
cd seed && python seed.py
```

| Entity | Count | Key Distributions |
|--------|-------|------------------|
| City zones | 6 | Gulberg, DHA, Johar Town, Model Town, Bahria Town, Cantt |
| Platforms | 5 | Careem (ride), Foodpanda (delivery), Uber (ride), InDriver (ride), Fiverr (freelance) |
| Workers | 210 | Spread across zones, variable shift frequency |
| Verifiers | 10 | |
| Advocates | 5 | |
| Shift logs | ~8,000 | Jan–Mar 2026, 3 months |
| Screenshots | ~3,000 | ~37% of shifts, fake Cloudinary URLs |
| Verifications | ~4,000 | ~50% confirmed, ~10% disputed, ~5% unverifiable (higher than initial to ensure `zone_earnings_summary` view has sufficient data) |
| Grievances | 67 | Includes 12-complaint Careem commission cluster in week 8 |
| Grievance tags | ~135 | Auto-generated |
| Anomaly results | ~43 | Pre-computed for demo |
| File uploads | 12 | Sample CSV import records |

**Key data distributions for meaningful analytics:**
- Careem commission: 20–25% normally, spikes to 30% in calendar week 8 (triggers anomaly detection)
- DHA workers earn ~15% more than Johar Town (visible in zone income distribution)
- 5 specific workers have >20% MoM income drops in March (vulnerability flags)
- 12 workers file `commission_change` complaints about Careem in the same week (forms a cluster)

**Required data files:**
```
seed/data/zones.json
seed/data/platforms.json
```

See DATABASE_PLAN.md for exact zone lat/lng and platform categories.

---

## 9. Anonymization Strategy

### Database-Level Enforcement

```sql
CREATE VIEW zone_earnings_summary AS
SELECT u.city_zone_id, cz.name AS zone_name, sl.platform_id, p.name AS platform_name,
       DATE_TRUNC('week', sl.shift_date) AS week,
       COUNT(*) AS total_shifts,
       COUNT(DISTINCT sl.worker_id) AS worker_count,
       PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sl.net_received) AS median_net,
       AVG(sl.platform_deductions / NULLIF(sl.gross_earned, 0)) * 100 AS avg_commission_rate
FROM shift_logs sl
JOIN users u ON sl.worker_id = u.id
JOIN city_zones cz ON u.city_zone_id = cz.id
JOIN platforms p ON sl.platform_id = p.id
WHERE sl.verification_status = 'verified'
GROUP BY u.city_zone_id, cz.name, sl.platform_id, p.name, DATE_TRUNC('week', sl.shift_date)
HAVING COUNT(DISTINCT sl.worker_id) >= 5;  -- k-anonymity enforcement
```

| Layer | Mechanism | Protects |
|-------|-----------|---------|
| Database | `zone_earnings_summary` VIEW + `HAVING COUNT >= 5` | k-anonymity in analytics |
| Database | Row-Level Security on `shift_logs` | Workers see only own data |
| Database | `monthly_worker_totals` MATERIALIZED VIEW | Pre-computed MoM totals |
| Application | Analytics Service queries only views | Advocates never see individual records |
| Application | `is_anonymous = true` → "Anonymous" in API | Grievance board privacy |
| Application | Vulnerability flags: `display_name` only | Minimum PII exposure |

---

## 10. Folder Structure

```
fairgig/
├── shared/
│   └── validators/
│       ├── common.py               ← Shared Pydantic types + sanitisers
│       ├── error_handlers.py       ← FastAPI global exception handlers
│       ├── file_validators.py      ← Screenshot + CSV upload validation
│       └── params.py               ← UUID path param helpers
│
├── services/
│   ├── auth/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models.py           ← SQLAlchemy 2.0 models (schema source of truth)
│   │   │   ├── schemas.py          ← RegisterRequest, LoginRequest (hardened v2)
│   │   │   ├── config.py           ← Pydantic Settings
│   │   │   ├── database.py         ← Async engine + get_db (commits on success)
│   │   │   ├── dependencies.py     ← get_current_user, require_role
│   │   │   ├── routes/auth.py
│   │   │   └── utils/
│   │   │       ├── jwt.py
│   │   │       └── hashing.py
│   │   ├── alembic/versions/
│   │   │   ├── 0001_initial_tables.py
│   │   │   ├── 0002_views.py
│   │   │   └── 0003_rls.py
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   ├── earnings/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models.py
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── dependencies.py
│   │   │   ├── schemas/shift.py    ← ShiftCreate, VerifyRequest, ShiftListParams, etc.
│   │   │   ├── routes/shifts.py    ← 13 endpoints with full validation wired
│   │   │   ├── services/
│   │   │   │   ├── shift_service.py
│   │   │   │   ├── import_service.py
│   │   │   │   ├── verification_service.py
│   │   │   │   └── cloudinary_service.py
│   │   │   └── utils/csv_validator.py  ← Full pipeline (FileRejected + row errors)
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   ├── anomaly/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── dependencies.py
│   │   │   ├── schemas/detect.py   ← DetectRequest + EarningEntry (judge-tested)
│   │   │   ├── routes/detect.py
│   │   │   └── engine/
│   │   │       ├── detector.py     ← Orchestrator (calls all methods)
│   │   │       ├── zscore.py
│   │   │       ├── iqr.py
│   │   │       ├── rolling.py
│   │   │       ├── mom.py
│   │   │       ├── sanity.py
│   │   │       └── explainer.py
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   ├── grievance/
│   │   ├── src/
│   │   │   ├── index.js            ← Express app, CORS, errorHandler last
│   │   │   ├── config.js
│   │   │   ├── routes/grievances.js ← 9 endpoints
│   │   │   ├── middleware/
│   │   │   │   ├── auth.js         ← Calls /api/auth/validate
│   │   │   │   ├── validate.js     ← Zod middleware wrapper
│   │   │   │   └── errorHandler.js ← Global Express error handler
│   │   │   ├── validators/grievanceValidator.js ← All Zod schemas
│   │   │   └── utils/autoTagger.js
│   │   ├── prisma/schema.prisma    ← Auto-generated via prisma db pull
│   │   ├── package.json            ← includes zod dependency
│   │   └── README.md
│   │
│   ├── analytics/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── config.py
│   │   │   ├── database.py
│   │   │   ├── dependencies.py
│   │   │   ├── schemas/analytics.py ← Query param bounds for all 5 endpoints
│   │   │   ├── routes/
│   │   │   │   ├── commission.py
│   │   │   │   ├── income.py
│   │   │   │   ├── vulnerability.py
│   │   │   │   ├── comparison.py
│   │   │   │   └── dashboard.py    ← asyncio.gather for parallel KPI queries
│   │   │   └── queries/
│   │   │       ├── commission_trends.py
│   │   │       ├── income_distribution.py
│   │   │       ├── vulnerability_flags.py
│   │   │       └── platform_comparison.py
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   └── certificate/
│       ├── app/
│       │   ├── main.py
│       │   ├── config.py
│       │   ├── dependencies.py
│       │   ├── routes/certificate.py ← /generate (HTML) + /preview (JSON)
│       │   └── templates/certificate.html ← Jinja2, print CSS, A4, watermark
│       ├── requirements.txt
│       └── README.md
│
├── seed/
│   ├── seed.py                     ← Idempotent, truncates first
│   ├── requirements.txt            ← psycopg2-binary + faker (sync, no asyncpg)
│   └── data/
│       ├── zones.json
│       └── platforms.json
│
├── docs/
│   ├── API_REFERENCE.md
│   ├── DATABASE_PLAN.md
│   └── POSTMAN_COLLECTION.json
│
├── .env
├── .env.example
└── README.md
```

---

## 11. Environment Variables

```env
# Database — async driver for services, sync for seed
DATABASE_URL=postgresql+asyncpg://postgres:password@localhost:5432/fairgig
JWT_SECRET=your-256-bit-secret-minimum-32-chars
JWT_ALGORITHM=HS256

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Service-to-service URLs
AUTH_SERVICE_URL=http://localhost:8001
EARNINGS_SERVICE_URL=http://localhost:8002
ANOMALY_SERVICE_URL=http://localhost:8003
GRIEVANCE_SERVICE_URL=http://localhost:8004
ANALYTICS_SERVICE_URL=http://localhost:8005
CERTIFICATE_SERVICE_URL=http://localhost:8006
```

---

## 12. API Endpoint Summary (38 total)

### Auth Service (:8001) — 6 endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/api/auth/register` | ✗ | — |
| POST | `/api/auth/login` | ✗ | — |
| POST | `/api/auth/refresh` | ✗ | — |
| GET | `/api/auth/me` | ✓ | any |
| GET | `/api/auth/validate` | ✓ | any (internal) |
| GET | `/api/auth/city-zones` | ✗ | — |

### Earnings Service (:8002) — 13 endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/api/earnings/shifts` | ✓ | worker |
| POST | `/api/earnings/shifts/import` | ✓ | worker |
| GET | `/api/earnings/shifts` | ✓ | worker |
| GET | `/api/earnings/shifts/:id` | ✓ | worker, verifier |
| POST | `/api/earnings/shifts/:id/screenshot` | ✓ | worker |
| GET | `/api/earnings/shifts/:id/screenshot` | ✓ | worker, verifier |
| GET | `/api/earnings/verification-queue` | ✓ | verifier |
| POST | `/api/earnings/shifts/:id/verify` | ✓ | verifier |
| GET | `/api/earnings/worker/:id/summary` | ✓ | worker |
| GET | `/api/earnings/worker/:id/trends` | ✓ | worker |
| GET | `/api/earnings/platforms` | ✓ | any |
| GET | `/api/earnings/imports` | ✓ | worker |

### Anomaly Service (:8003) — 3 endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/api/anomaly/detect` | ✗ | — (open, judge-tested) |
| POST | `/api/anomaly/analyze-worker` | ✓ | worker, advocate |
| GET | `/api/anomaly/results/:worker_id` | ✓ | worker, advocate |

### Grievance Service (:8004) — 9 endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| POST | `/api/grievances` | ✓ | worker |
| GET | `/api/grievances` | ✓ | any |
| GET | `/api/grievances/:id` | ✓ | any |
| PATCH | `/api/grievances/:id/status` | ✓ | advocate |
| POST | `/api/grievances/:id/tags` | ✓ | advocate |
| DELETE | `/api/grievances/:id/tags/:tag` | ✓ | advocate |
| GET | `/api/grievances/clusters` | ✓ | advocate |
| GET | `/api/grievances/stats` | ✓ | advocate |
| DELETE | `/api/grievances/:id` | ✓ | worker (own), advocate (any) |

### Analytics Service (:8005) — 5 endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/analytics/commission-trends` | ✓ | advocate |
| GET | `/api/analytics/income-distribution` | ✓ | advocate |
| GET | `/api/analytics/vulnerability-flags` | ✓ | advocate |
| GET | `/api/analytics/dashboard-summary` | ✓ | advocate |
| GET | `/api/analytics/platform-comparison` | ✓ | advocate |

### Certificate Renderer (:8006) — 2 endpoints
| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/certificate/generate` | ✓ | worker |
| GET | `/api/certificate/preview` | ✓ | worker |

---

## 13. Python Requirements

```
# Base (all Python services)
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.14.1
pyjwt==2.10.1
bcrypt==4.2.1
pydantic==2.10.4
pydantic-settings==2.7.1
python-dotenv==1.0.1
python-multipart==0.0.20
httpx==0.28.1
cloudinary==1.41.0

# Earnings Service (add to above)
openpyxl==3.1.5
chardet==5.2.0

# Seed script (separate, sync drivers)
sqlalchemy==2.0.36
psycopg2-binary==2.9.10
bcrypt==4.2.1
python-dotenv==1.0.1
faker==33.1.0
openpyxl==3.1.5
```

---

## 14. Known Issues and Fixes

| Issue | Fix Applied |
|-------|------------|
| `DATE_TRUNC` functional index on `shift_logs` fails with "IMMUTABLE" error | Index removed from migration `0001`. The `monthly_worker_totals` materialized view covers this access pattern. |
| Auth `register` route does `db.flush()` without committing | `get_db` dependency must `await session.commit()` after `yield`. Pattern: `yield session; await session.commit()` in try block. |
| RLS blocks service queries when session variables not set | Connect services as PostgreSQL table owner (RLS does not apply to table owners by default). Or set `SET LOCAL app.current_user_id` in `get_db`. |
| `make_shift()` dead code in seed script | Removed — shift generation is done inline in `seed_shift_logs`. |
| `seed/data/zones.json` and `platforms.json` not generated by seed | Create manually with data from DATABASE_PLAN.md. |
| `zone_earnings_summary` view returns few rows | Increase verified shifts in seed to ~4,000 (was 2,400) to ensure `HAVING COUNT >= 5` passes for more zone/platform/week combinations. |
| `Annotated` import missing in Python 3.10 | Import from `typing` not `__future__`. Use `from typing import Annotated` or `from typing_extensions import Annotated` for 3.9. |

---

## 15. Judging Criteria Alignment

| Criteria | Evidence |
|----------|----------|
| **Technology choices** | PostgreSQL + DECIMAL (financial precision), SQLAlchemy 2.0 + Prisma (ecosystem-native ORMs), Cloudinary (managed CDN for images AND raw files), Pydantic v2 + Zod (appropriate per language ecosystem) |
| **Justification** | Every choice has a stated reason — DECIMAL not float, k-anonymity threshold = 5, Z-score threshold = 2.0, Prisma introspection avoids duplication, Pydantic is Python-native not Zod |
| **Scalability** | Async FastAPI + asyncpg, connection pooling, materialized views for heavy aggregates, Cloudinary CDN, paginated APIs with hard limits (max 100 per page, max 5,000 CSV rows) |
| **Performance** | `asyncio.gather` for advocate dashboard (single round-trip), partial index on `verification_status = 'pending'` for verifier queue, `monthly_worker_totals` materialized view for MoM queries |
| **Edge-case handling** | CSV formula injection detection, multi-format date parsing, European decimal format support, anomaly service handles empty/minimal/identical data gracefully, k-anonymity threshold enforced at view level |
| **Clarity** | Shared validator modules reduce duplication, standard error format across 6 services, each service has README + single start command, seed data has realistic distributions with known anomalies |