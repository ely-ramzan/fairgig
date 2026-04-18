# FairGig — Project Requirements Document (PRD)

## SOFTEC 2026 Web Dev Competition

---

## 1. Problem Statement

Pakistan has millions of gig workers — ride-hailing drivers, food delivery riders, freelance designers, domestic workers — who earn income across multiple platforms with no unified record, no payslip, and no protection when platforms change commission rates overnight or deactivate accounts without explanation.

FairGig empowers gig workers to log, verify, and understand their earnings across platforms, while giving labour advocates a dashboard to spot systemic unfairness at scale.

---

## 2. User Personas

| Persona | Role Key | Core Actions |
|---------|----------|-------------|
| **Gig Worker** | `worker` | Logs shifts and earnings, uploads platform screenshots for verification, views income analytics and trends, generates a shareable income certificate |
| **Verifier** | `verifier` | Reviews uploaded earnings screenshots, flags anomalies, approves or disputes a worker's submitted earnings record |
| **Advocate / Analyst** | `advocate` | Monitors aggregate trends — commission rate changes across platforms, income volatility by city zone, deactivation complaint clusters |
| **Worker Community** | `worker` | Anonymous bulletin board where workers post rate intel, platform complaints, and support requests (moderated by advocates) |

---

## 3. Tech Stack

### 3.1 Backend Services

| Service | Language / Framework | Port | Justification |
|---------|---------------------|------|---------------|
| Auth Service | Python FastAPI | 8001 | JWT-based auth, single validation endpoint for inter-service token verification |
| Earnings Service | Python FastAPI | 8002 | Core data service — shift CRUD, CSV import, screenshot management, verification workflow |
| Anomaly Service | Python FastAPI **(mandatory)** | 8003 | Statistical analysis engine — Z-score, IQR methods. Judge-tested endpoint |
| Grievance Service | Node.js + Express **(mandatory)** | 8004 | Community bulletin board, complaint CRUD, clustering, escalation workflow |
| Analytics Service | Python FastAPI | 8005 | Aggregate KPIs for advocate dashboard, anonymized queries via DB views |
| Certificate Renderer | Python FastAPI | 8006 | Stateless HTML certificate generation using Jinja2 templates |

### 3.2 Database

| Component | Choice | Justification |
|-----------|--------|---------------|
| Database | **PostgreSQL** | Relational integrity for earnings/verification data, window functions for analytics (PERCENTILE_CONT, LAG, PERCENT_RANK), Row-Level Security for anonymization, JSONB for semi-structured anomaly results, full-text search (tsvector) for grievance board |

### 3.3 ORM Strategy

| Ecosystem | ORM | Justification |
|-----------|-----|---------------|
| Python (4 services) | **SQLAlchemy 2.0 + Alembic** | Industry standard for FastAPI, modern async syntax, Alembic handles migrations as single source of truth |
| Node.js (Grievance) | **Prisma** | Introspects existing PostgreSQL tables created by Alembic — no duplicate schema definitions. Typed client, cleaner than TypeORM. `prisma db pull` auto-generates schema from existing DB |

**Migration flow:**
1. SQLAlchemy models defined in Auth Service (source of truth for schema)
2. Alembic migrations create/update tables in PostgreSQL
3. Grievance Service runs `npx prisma db pull` → auto-generates `schema.prisma`
4. `npx prisma generate` → typed Prisma client ready

**Analytics queries:** Complex aggregates (window functions, CTEs, percentiles) written as raw SQL via SQLAlchemy `text()` — ORMs make these harder, not easier.

### 3.4 File Storage

| Component | Choice | Justification |
|-----------|--------|---------------|
| File Storage | **Cloudinary** | Managed CDN, automatic image optimization (WebP, quality auto), thumbnail transformations for verifier queue, no infrastructure to manage |

**Cloudinary is used for:**
- **Screenshot uploads** — worker earnings screenshots for verification
- **CSV/Excel file uploads** — original imported files archived for audit trail
- **Certificate assets** — (if needed) logos or generated certificate snapshots

**Upload flow (server-side only):**
```
User → Browser → FastAPI Earnings Service → Cloudinary Upload API → Returns secure_url + public_id → Stored in DB
```

Direct browser-to-Cloudinary uploads are **disabled** — all uploads route through the backend to enforce auth and validation.

**Cloudinary configuration:**
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**Folder structure in Cloudinary:**
```
fairgig/
├── screenshots/{worker_id}/{shift_log_id}.jpg
└── imports/{worker_id}/{import_id}.csv
```

### 3.5 Frontend

| Component | Choice |
|-----------|--------|
| Framework | **React** (Vite) |
| Styling | Tailwind CSS |
| Charts | Recharts |
| State Management | React Query (TanStack Query) for server state, Zustand for UI state |
| HTTP Client | Axios with interceptors for JWT refresh |
| Routing | React Router v6 |

### 3.6 Auth

| Component | Choice | Details |
|-----------|--------|---------|
| Token type | **JWT** (PyJWT) | Stateless, inter-service validation |
| Access token expiry | 15 minutes | Short-lived for security |
| Refresh token expiry | 7 days | Stored client-side |
| Password hashing | bcrypt (12 salt rounds) | Industry standard |
| Inter-service auth | Internal `/api/auth/validate` endpoint | Other services call Auth Service to verify incoming tokens — avoids sharing JWT secret |

---

## 4. Core Functional Requirements

### 4.1 Earnings Logger
- Workers log shifts: platform, date, hours worked, gross earned, platform deductions, net received
- Manual entry via form
- Bulk CSV/Excel import for tech-savvy users
- Original CSV/Excel files archived on Cloudinary for audit trail
- Validation: `net_received ≈ gross_earned - platform_deductions` (2% tolerance for rounding)
- Deduplication: UNIQUE constraint on `(worker_id, platform_id, shift_date, gross_earned)`

### 4.2 Screenshot Verification Flow
- Worker uploads a platform earnings screenshot (PNG/JPG, max 5MB)
- Image uploaded to Cloudinary with auto-optimization
- Verifier reviews screenshot in a FIFO queue (oldest first)
- Verifier can: **confirm**, **flag a discrepancy**, or **mark unverifiable**
- If disputed: verifier enters their own read of gross/deductions from the screenshot
- System computes discrepancy between worker-claimed and verifier-read values
- Verification status shown on worker's profile
- State machine: `pending → verified | disputed | unverifiable`. Disputed shifts can be re-submitted (worker uploads new screenshot, status resets to pending). Verified is final.

### 4.3 Income Analytics Dashboard (Worker View)
- Weekly/monthly earnings trends (line chart)
- Effective hourly rate over time (line chart)
- Platform commission rate tracker (per-platform line chart)
- Comparison against anonymised city-wide median for their category
  - Uses real aggregated data from seeded records (NOT hardcoded)
  - k-anonymity enforced: city-zone groups with fewer than 5 workers excluded
  - Percentile rank shown: "You earned more than X% of workers in your zone"

### 4.4 Shareable Income Certificate
- Worker selects a date range
- System generates a clean, print-friendly HTML page
- Shows only verified earnings (configurable)
- Includes: total gross, deductions, net, hours, effective hourly rate, per-platform breakdown
- Certificate number (UUID short hash) for reference
- Honest disclaimer: "This certificate reflects self-reported earnings, verified where possible. FairGig does not guarantee accuracy."
- Print-optimized CSS: `@media print` rules, A4 sizing, no background colors

### 4.5 Grievance Board
- Workers post complaints: platform, category, description
- Categories: `commission_change`, `deactivation`, `payment_delay`, `unfair_rating`, `safety`, `other`
- Anonymous by default (`is_anonymous = true`)
- Auto-tagging: keywords in description auto-generate initial tags
- Advocates can: tag, cluster similar complaints, mark escalated or resolved
- Full-text search on complaint descriptions (PostgreSQL tsvector)
- Status workflow: `open → escalated → resolved` (no backwards transitions)

### 4.6 Advocate Analytics Panel
- Commission rates reported across platforms over time
- Income distribution by city zone (P25, P50 median, P75)
- Top complaint categories this week
- Vulnerability flags: workers whose income dropped >20% month-on-month
- Platform fairness comparison with composite score
- All aggregate queries use anonymized views — never expose individual worker data (except vulnerability flags, which show display_name only, never email/phone)

### 4.7 Anomaly Detection Service
- Accepts a worker's earnings history (array of shift objects)
- Detection methods:
  - **Z-score** on commission rates per platform (threshold: |Z| > 2.0)
  - **IQR method** on effective hourly rates (outliers beyond Q1-1.5×IQR or Q3+1.5×IQR)
  - **Rolling average** comparison for income drops (current < 70% of 7-day rolling avg)
  - **Month-over-month** total comparison (>20% drop = high severity)
  - **Hours sanity check** (>16 hours in single shift flagged)
- Returns human-readable explanations for each anomaly
- Severity levels: `low`, `medium`, `high`
- **Judge-tested**: the `/detect` endpoint must handle edge cases (minimal data, identical values, single platform, etc.)

---

## 5. Service Architecture

### 5.1 Inter-Service Communication
- All services communicate via **REST API calls** over HTTP
- Auth validation: services call `GET /api/auth/validate` with the Bearer token
- Earnings data: Anomaly and Certificate services call Earnings Service endpoints
- Grievance stats: Analytics Service calls Grievance Service for complaint counts
- No message queue needed at this scale — direct HTTP is simpler and sufficient

### 5.2 API Documentation
- All inter-service API contracts documented in `API_REFERENCE.md`
- Each endpoint: method, path, input (params/query/body), output (status codes + body), processing logic
- Postman collection exported for judges

### 5.3 Service Independence
- Each service independently runnable with a single start command
- Each service has its own `README.md` with setup instructions
- Shared database (PostgreSQL) — services own specific tables
- No Docker required — `pip install` / `npm install` + start command

---

## 6. Data Seeding Strategy

Seed script generates realistic data for demo and evaluation:
- **200+ workers** across 5-6 city zones (Lahore zones: Gulberg, DHA, Johar Town, Model Town, Bahria Town, Cantt)
- **4 platforms**: Careem, Foodpanda, Uber, InDriver (with realistic commission rate distributions)
- **3 months of shift history** per worker (variable frequency — some workers log daily, some weekly)
- **Non-uniform distributions**: higher commission rates in some zones, one platform with a mid-period commission increase (to trigger anomaly detection)
- **Grievances**: 50+ complaints with realistic clustering (multiple workers complaining about same platform+category in same week)
- **Verifications**: ~60% of shifts verified, ~10% disputed, ~5% unverifiable
- **Pre-computed anomaly results** for demo purposes

---

## 7. Anonymization Strategy

### Database-Level Enforcement
1. **`zone_earnings_summary` VIEW** — pre-aggregates earnings by city zone, platform, and week with `HAVING COUNT(*) >= 5` (k-anonymity)
2. **Row-Level Security (RLS)** — workers can only SELECT their own rows from `shift_logs`
3. **Analytics Service** queries ONLY the aggregate view, never raw shift_logs
4. **Grievance anonymity** — `is_anonymous = true` replaces worker identity with "Anonymous" at the API level
5. **Vulnerability flags** — the one exception where individual workers are shown to advocates, but only `display_name`, never `email` or `phone`

---

## 8. Folder Structure

```
fairgig/
├── services/
│   ├── auth/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models.py          # SQLAlchemy models (source of truth)
│   │   │   ├── schemas.py         # Pydantic request/response schemas
│   │   │   ├── routes/
│   │   │   │   └── auth.py
│   │   │   ├── utils/
│   │   │   │   ├── jwt.py
│   │   │   │   └── hashing.py
│   │   │   ├── database.py        # SQLAlchemy engine + session
│   │   │   └── config.py          # env vars
│   │   ├── alembic/               # Migrations (shared across Python services)
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   ├── earnings/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── models.py
│   │   │   ├── schemas.py
│   │   │   ├── routes/
│   │   │   │   ├── shifts.py
│   │   │   │   ├── verification.py
│   │   │   │   └── screenshots.py
│   │   │   ├── utils/
│   │   │   │   ├── csv_parser.py
│   │   │   │   └── cloudinary_upload.py
│   │   │   ├── database.py
│   │   │   └── config.py
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   ├── anomaly/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── schemas.py
│   │   │   ├── routes/
│   │   │   │   └── detect.py
│   │   │   ├── engine/
│   │   │   │   ├── zscore.py       # Z-score detection
│   │   │   │   ├── iqr.py          # IQR detection
│   │   │   │   ├── rolling.py      # Rolling average detection
│   │   │   │   └── explainer.py    # Human-readable explanation generator
│   │   │   ├── database.py
│   │   │   └── config.py
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   ├── grievance/
│   │   ├── src/
│   │   │   ├── index.js
│   │   │   ├── routes/
│   │   │   │   ├── grievances.js
│   │   │   │   └── tags.js
│   │   │   ├── middleware/
│   │   │   │   └── auth.js         # Calls Auth Service /validate
│   │   │   ├── utils/
│   │   │   │   └── autoTagger.js
│   │   │   └── config.js
│   │   ├── prisma/
│   │   │   └── schema.prisma       # Auto-generated via `prisma db pull`
│   │   ├── package.json
│   │   └── README.md
│   │
│   ├── analytics/
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── routes/
│   │   │   │   ├── commission.py
│   │   │   │   ├── income.py
│   │   │   │   ├── vulnerability.py
│   │   │   │   └── dashboard.py
│   │   │   ├── queries/            # Raw SQL files for complex aggregates
│   │   │   │   ├── commission_trends.sql
│   │   │   │   ├── income_distribution.sql
│   │   │   │   └── vulnerability_flags.sql
│   │   │   ├── database.py
│   │   │   └── config.py
│   │   ├── requirements.txt
│   │   └── README.md
│   │
│   └── certificate/
│       ├── app/
│       │   ├── main.py
│       │   ├── routes/
│       │   │   └── certificate.py
│       │   ├── templates/
│       │   │   └── certificate.html  # Jinja2 template
│       │   └── config.py
│       ├── requirements.txt
│       └── README.md
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── api/
│   │   ├── store/
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
├── seed/
│   ├── seed.py                     # Main seed script
│   ├── data/
│   │   ├── zones.json
│   │   ├── platforms.json
│   │   └── workers.json
│   └── README.md
│
├── docs/
│   ├── API_REFERENCE.md
│   ├── DATABASE_PLAN.md
│   └── POSTMAN_COLLECTION.json
│
├── .env.example
└── README.md                       # Root README with full setup instructions
```

---

## 9. Environment Variables

```env
# Shared
DATABASE_URL=postgresql://user:password@localhost:5432/fairgig
JWT_SECRET=your-256-bit-secret

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Service Ports
AUTH_SERVICE_URL=http://localhost:8001
EARNINGS_SERVICE_URL=http://localhost:8002
ANOMALY_SERVICE_URL=http://localhost:8003
GRIEVANCE_SERVICE_URL=http://localhost:8004
ANALYTICS_SERVICE_URL=http://localhost:8005
CERTIFICATE_SERVICE_URL=http://localhost:8006
```

---

## 10. Judging Criteria Alignment

| Criteria | How FairGig Addresses It |
|----------|--------------------------|
| **Technology choices** | PostgreSQL for relational integrity + analytics, SQLAlchemy + Prisma split by ecosystem, Cloudinary for managed file storage, FastAPI for async Python services |
| **Justification of decisions** | Every choice tied to the problem context — DECIMAL for money, k-anonymity views for privacy, Z-score/IQR for anomaly detection, Prisma introspection to avoid schema duplication |
| **Scalability** | Async FastAPI, connection pooling, materialized views for heavy aggregates, Cloudinary CDN for image delivery, paginated APIs throughout |
| **Performance** | Analytics dashboard loads via single endpoint with parallel queries (asyncio.gather), verification queue uses partial indexes, Cloudinary auto-optimizes images |
| **Edge-case handling** | CSV format detection, deduplication constraints, verification state machine, anomaly service handles minimal data gracefully, k-anonymity thresholds |
| **Clarity of implementation** | Clean folder structure, documented API contracts, each service independently runnable, seed script for realistic demo data |
