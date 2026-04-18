# FairGig — Task Breakdown & Work Distribution

## Team Assignments

| Member | Responsibility | Services |
|--------|---------------|----------|
| **Shaheer** | Database setup, migrations, seed data, Prisma introspection | PostgreSQL, Alembic, seed script |
| **Ali** | Core data pipeline — earnings logging through to certificate generation | Earnings Service + Certificate Renderer |
| **Hamza** | Intelligence & community layer — anomaly detection, grievance board, analytics | Anomaly Service + Grievance Service (Node.js) + Analytics Service |

### Why This Split

Ali gets the **Earnings Service** (13 endpoints, most complex, handles Cloudinary integration, CSV import, verification workflow) plus the **Certificate Renderer** (2 endpoints, lightweight, depends directly on Earnings data). These are tightly coupled — the certificate calls Earnings endpoints internally, so the same person understanding both avoids integration friction.

Hamza gets three services but they're individually smaller: **Anomaly Service** (3 endpoints, focused statistical logic), **Grievance Service** (9 endpoints, Node.js — independent stack), and **Analytics Service** (5 endpoints, mostly SQL queries reading existing data). These services are consumers of Ali's data but don't depend on each other, so Hamza can build them in any order.

---

## Dependency Graph

```
Shaheer: DB + Migrations + Seed
            │
            │ tables ready
            ▼
    ┌───────────────────┐
    │                   │
    ▼                   ▼
  ALI                 HAMZA
  Earnings Svc        Anomaly Svc ◄── can start immediately
  (needs DB)          (stateless /detect needs NO database)
    │                   │
    │                 Grievance Svc ◄── needs DB + Prisma introspection
    │                   │
    │                 Analytics Svc ◄── needs DB with seeded data
    │                   │
    ▼                   │
  Certificate Svc      │
  (calls Earnings)     │
    │                   │
    └───────┬───────────┘
            ▼
      Integration Testing
      (all services running)
```

**Key insight:** Hamza's Anomaly Service `/detect` endpoint is **completely stateless** — it takes raw JSON input and returns results. Hamza can build and test this while Shaheer is still setting up the database. This is where Hamza should start.

---

## Timeline (Hackathon Sprint)

Assuming a ~12-14 hour hackathon window.

```
Hour 0-1:   Shaheer finishes DB. Ali + Hamza set up service scaffolding.
Hour 1-4:   Ali → Earnings core. Hamza → Anomaly engine + Grievance setup.
Hour 4-7:   Ali → Verification + Cloudinary. Hamza → Grievance CRUD + Analytics.
Hour 7-9:   Ali → Trends + Certificate. Hamza → Clusters + Dashboard.
Hour 9-11:  Integration testing. Bug fixes. Seed data verification.
Hour 11-13: Frontend integration. Polish. Demo prep.
Hour 13-14: Final testing. Presentation prep.
```

---

## ALI's Tasks

### Phase A1: Earnings Service — Scaffolding (Hour 0-1)

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| A1.1 | Create `services/earnings/` folder structure matching architecture doc | HIGH | 15 min |
| A1.2 | Set up `main.py` with FastAPI app, CORS middleware, router registration | HIGH | 10 min |
| A1.3 | Set up `config.py` (copy from auth, add Cloudinary vars) | HIGH | 5 min |
| A1.4 | Set up `database.py` with async engine + `get_db` dependency (copy from auth, add commit logic) | HIGH | 10 min |
| A1.5 | Copy `models.py` from auth service (all models needed) | HIGH | 5 min |
| A1.6 | Create `dependencies.py` with `validate_token()`, `get_current_user()`, `require_role()` — these call Auth Service via HTTP | HIGH | 20 min |

**Deliverable:** Service starts on port 8002, dependencies resolve, auth validation works.

### Phase A2: Earnings — Shift CRUD (Hour 1-2.5)

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| A2.1 | Create Pydantic schemas: `ShiftCreate`, `ShiftOut`, `ShiftFilter`, `PaginatedShifts` | HIGH | 15 min |
| A2.2 | Implement `POST /api/earnings/shifts` — create a single shift with math validation (net ≈ gross - deductions, 2% tolerance) | HIGH | 25 min |
| A2.3 | Implement `GET /api/earnings/shifts` — paginated list with filters (platform, date range, status, sort) | HIGH | 25 min |
| A2.4 | Implement `GET /api/earnings/shifts/:id` — single shift with JOINed screenshot + verification | HIGH | 15 min |
| A2.5 | Implement `GET /api/earnings/platforms` — simple list query | LOW | 10 min |

**Deliverable:** Workers can log shifts and browse their history. Math validation catches bad entries.

### Phase A3: Earnings — CSV/Excel Import + Cloudinary (Hour 2.5-4.5)

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| A3.1 | Create `cloudinary_service.py` — upload wrapper for images (screenshots) and raw files (CSV/Excel) | HIGH | 25 min |
| A3.2 | Create `import_service.py` — CSV parser (detect delimiter, normalize headers, multi-format date parsing) | HIGH | 30 min |
| A3.3 | Add Excel parsing to `import_service.py` using openpyxl (read first sheet, same validation) | MEDIUM | 15 min |
| A3.4 | Implement `POST /api/earnings/shifts/import` — full flow: upload file to Cloudinary, parse, validate rows, batch insert, record in `file_uploads` | HIGH | 30 min |
| A3.5 | Implement `GET /api/earnings/imports` — worker's import history | LOW | 10 min |

**Deliverable:** Workers can import CSV/Excel files. Files archived on Cloudinary. Row-level error reporting works.

**Testing checkpoint:** Import a sample CSV with some bad rows. Verify: file appears on Cloudinary, valid rows inserted, errors reported, duplicates skipped.

### Phase A4: Earnings — Screenshot + Verification (Hour 4.5-6.5)

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| A4.1 | Implement `POST /api/earnings/shifts/:id/screenshot` — upload image to Cloudinary, store metadata, handle re-upload after dispute | HIGH | 25 min |
| A4.2 | Implement `GET /api/earnings/shifts/:id/screenshot` — return Cloudinary URL (full or thumbnail) | MEDIUM | 15 min |
| A4.3 | Create `verification_service.py` — state machine logic (`VALID_TRANSITIONS` dict), discrepancy calculation | HIGH | 20 min |
| A4.4 | Implement `GET /api/earnings/verification-queue` — paginated pending shifts with screenshot thumbnails, FIFO ordering | HIGH | 20 min |
| A4.5 | Implement `POST /api/earnings/shifts/:id/verify` — verifier submits decision, updates shift status, calculates discrepancy | HIGH | 25 min |

**Deliverable:** Complete verification workflow. Workers upload screenshots, verifiers review and decide, state machine enforces valid transitions.

**Testing checkpoint:** Create shift → upload screenshot → verify as confirmed → try to re-verify (should fail). Create shift → upload screenshot → dispute → re-upload screenshot (status resets to pending).

### Phase A5: Earnings — Trends + City Median (Hour 6.5-8)

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| A5.1 | Implement `GET /api/earnings/worker/:id/summary` — aggregate earnings for date range (total gross, net, hours, per-platform breakdown) | HIGH | 25 min |
| A5.2 | Implement `GET /api/earnings/worker/:id/trends` — three datasets: earnings_trend, commission_trend, city_median_comparison | HIGH | 35 min |
| A5.3 | Write the city median comparison query using `zone_earnings_summary` view — ensure k-anonymity works (test with seeded data) | HIGH | 20 min |

**Deliverable:** Worker dashboard data is fully available. City median comparison uses real aggregated data from seeded records.

**Testing checkpoint:** Query `/trends` for a DHA worker — their income should be ~15% above the city median. Query for a Careem driver — commission trend should show a spike in week 8.

### Phase A6: Certificate Renderer (Hour 8-9)

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| A6.1 | Create `services/certificate/` scaffolding (main.py, config.py, dependencies.py) | HIGH | 10 min |
| A6.2 | Create Jinja2 template `certificate.html` with print-friendly CSS (@media print, A4 sizing, no background colors) | HIGH | 25 min |
| A6.3 | Implement `GET /api/certificate/preview` — fetch data from Earnings Service, return JSON | MEDIUM | 15 min |
| A6.4 | Implement `GET /api/certificate/generate` — fetch data, render Jinja2 template, return HTML | HIGH | 15 min |

**Deliverable:** Workers can generate and print income certificates. Print layout looks clean on A4.

---

## HAMZA's Tasks

### Phase H1: Anomaly Service — Detection Engine (Hour 0-3)

**Start here first — the `/detect` endpoint is stateless and judge-tested. No database needed. You can build and test this immediately while Shaheer finishes DB setup.**

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| H1.1 | Create `services/anomaly/` folder structure | HIGH | 10 min |
| H1.2 | Set up FastAPI app (main.py, config.py) | HIGH | 10 min |
| H1.3 | Create Pydantic schemas: `DetectRequest` (array of earnings), `DetectResponse` (array of anomalies with explanation) | HIGH | 15 min |
| H1.4 | Implement `engine/zscore.py` — Z-score detection on commission rates per platform (threshold: \|Z\| > 2.0) | HIGH | 25 min |
| H1.5 | Implement `engine/iqr.py` — IQR method on effective hourly rates (outliers beyond Q1-1.5×IQR) | HIGH | 20 min |
| H1.6 | Implement `engine/rolling.py` — rolling 7-shift average, flag if current < 70% of average | HIGH | 20 min |
| H1.7 | Implement `engine/mom.py` — month-over-month total comparison, flag if >20% drop | HIGH | 15 min |
| H1.8 | Implement `engine/sanity.py` — hours > 16 flag, below minimum wage flag | MEDIUM | 10 min |
| H1.9 | Implement `engine/explainer.py` — human-readable template-based explanations | HIGH | 15 min |
| H1.10 | Implement `engine/detector.py` — orchestrator that calls all methods, deduplicates, sorts by severity | HIGH | 15 min |
| H1.11 | Implement `POST /api/anomaly/detect` — the judge-tested endpoint. Validate input, run detector, return results | HIGH | 15 min |

**Deliverable:** The `/detect` endpoint works with raw JSON payloads. No database dependency.

**Testing checkpoint — create a test payload and verify:**
```json
{
  "earnings": [
    {"shift_date": "2026-01-15", "platform": "Careem", "gross_earned": 2500, "platform_deductions": 550, "net_received": 1950, "hours_worked": 6},
    {"shift_date": "2026-01-16", "platform": "Careem", "gross_earned": 2300, "platform_deductions": 506, "net_received": 1794, "hours_worked": 5.5},
    {"shift_date": "2026-01-17", "platform": "Careem", "gross_earned": 2400, "platform_deductions": 528, "net_received": 1872, "hours_worked": 6},
    {"shift_date": "2026-01-18", "platform": "Careem", "gross_earned": 2600, "platform_deductions": 780, "net_received": 1820, "hours_worked": 7},
    {"shift_date": "2026-01-19", "platform": "Careem", "gross_earned": 2200, "platform_deductions": 484, "net_received": 1716, "hours_worked": 5}
  ]
}
```

Entry 4 has deductions of 780/2600 = 30% vs the others at ~22%. This should trigger a `unusual_deduction` anomaly with high severity.

**Also test edge cases:**
- Empty array → `{anomalies_found: 0}`
- 2 entries → `{anomalies_found: 0}` (not enough data)
- All identical values → no anomalies (std_dev ≈ 0, IQR = 0)

### Phase H2: Anomaly Service — DB Integration (Hour 3-4)

**These tasks require DB to be ready (Shaheer).**

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| H2.1 | Set up `database.py` and `dependencies.py` (auth validation via HTTP) | HIGH | 15 min |
| H2.2 | Implement `POST /api/anomaly/analyze-worker` — fetch earnings from Earnings Service API, run detector, cache results in `anomaly_results` table | MEDIUM | 25 min |
| H2.3 | Implement `GET /api/anomaly/results/:worker_id` — return cached anomaly results (filterable by severity, date) | MEDIUM | 15 min |

**Deliverable:** Full anomaly service with both stateless detection and persistent results.

### Phase H3: Grievance Service — Setup + CRUD (Hour 3-5.5)

**Can start as soon as DB is ready. This is Node.js — different mental context from Python.**

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| H3.1 | Initialize Node.js project: `npm init`, install Express, Prisma, axios, Joi, cors, dotenv | HIGH | 10 min |
| H3.2 | Run `npx prisma db pull` to introspect existing PostgreSQL schema → generates `schema.prisma` | HIGH | 5 min |
| H3.3 | Run `npx prisma generate` → creates typed Prisma client | HIGH | 5 min |
| H3.4 | Set up Express app (index.js): CORS, JSON parsing, error handler, route registration | HIGH | 15 min |
| H3.5 | Create auth middleware — validates token by calling Auth Service `/api/auth/validate` via axios | HIGH | 15 min |
| H3.6 | Create `autoTagger.js` — keyword-based auto-tagging (commission keywords → commission_increase tag, etc.) | MEDIUM | 15 min |
| H3.7 | Implement `POST /api/grievances` — create complaint with auto-tagging, sanitize HTML from description | HIGH | 20 min |
| H3.8 | Implement `GET /api/grievances` — paginated list with filters (platform, category, status, tag, full-text search via raw SQL) | HIGH | 25 min |
| H3.9 | Implement `GET /api/grievances/:id` — single grievance with tags | MEDIUM | 10 min |
| H3.10 | Implement `PATCH /api/grievances/:id/status` — advocate updates status (validate transitions: open→escalated, open→resolved, escalated→resolved) | HIGH | 15 min |
| H3.11 | Implement `POST /api/grievances/:id/tags` + `DELETE /api/grievances/:id/tags/:tag` — tag management for advocates | MEDIUM | 15 min |
| H3.12 | Implement `DELETE /api/grievances/:id` — worker deletes own, advocate deletes any | LOW | 10 min |

**Deliverable:** Grievance CRUD fully working with auto-tagging and full-text search.

### Phase H4: Grievance Service — Clusters + Stats (Hour 5.5-7)

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| H4.1 | Implement `GET /api/grievances/clusters` — raw SQL via Prisma `$queryRaw`: GROUP BY platform + category + timeframe, HAVING count >= min_cluster_size, include sample descriptions and common tags | HIGH | 30 min |
| H4.2 | Implement `GET /api/grievances/stats` — aggregate queries: total open, escalated, resolved this period, by_category, by_platform, trending_tags | HIGH | 25 min |

**Deliverable:** Advocate can see complaint clusters (10+ Careem commission complaints in same week should form a visible cluster).

**Testing checkpoint:** With seeded data, `GET /api/grievances/clusters?days=60&min_cluster_size=3` should return a Careem + commission_change cluster with count >= 10.

### Phase H5: Analytics Service (Hour 7-9)

| # | Task | Priority | Est. Time |
|---|------|----------|-----------|
| H5.1 | Create `services/analytics/` scaffolding (main.py, config.py, database.py, dependencies.py) | HIGH | 15 min |
| H5.2 | Implement `GET /api/analytics/commission-trends` — query `zone_earnings_summary` view, group by platform + week | HIGH | 20 min |
| H5.3 | Implement `GET /api/analytics/income-distribution` — PERCENTILE_CONT for P25/P50/P75 by city zone | HIGH | 20 min |
| H5.4 | Implement `GET /api/analytics/vulnerability-flags` — window function query on `monthly_worker_totals`, LAG for MoM comparison, threshold filter | HIGH | 25 min |
| H5.5 | Implement `GET /api/analytics/platform-comparison` — composite fairness score across platforms | MEDIUM | 20 min |
| H5.6 | Implement `GET /api/analytics/dashboard-summary` — run all KPI queries in parallel with `asyncio.gather` | HIGH | 20 min |

**Deliverable:** Full advocate analytics panel with commission trends, income distribution, vulnerability flags, and platform comparison.

**Testing checkpoint:**
- Commission trends should show Careem spike in week 8
- Income distribution should show DHA zone earning more than Johar Town
- Vulnerability flags should catch the 5 workers with >20% MoM drops
- Platform comparison should rank InDriver highest (lowest commission ~10-18%)

---

## Integration Tasks (Both Ali + Hamza, Hour 9-11)

| # | Task | Owner | Est. Time |
|---|------|-------|-----------|
| I1 | Test Certificate Service calls Earnings Service summary endpoint | Ali | 15 min |
| I2 | Test Anomaly `/analyze-worker` calls Earnings Service shifts endpoint | Hamza | 15 min |
| I3 | Test Analytics Service reads from seeded data correctly | Hamza | 15 min |
| I4 | Verify all services validate tokens through Auth Service | Both | 15 min |
| I5 | Run full workflow test: register → log shift → upload screenshot → verify → check trends → generate certificate | Both | 30 min |
| I6 | Test anomaly detection against seeded Careem week-8 spike data | Hamza | 15 min |
| I7 | Test grievance clustering with seeded complaint data | Hamza | 10 min |
| I8 | Test vulnerability flags catch the 5 income-drop workers | Hamza | 10 min |
| I9 | Create/export Postman collection for all endpoints (judges want this) | Both | 20 min |
| I10 | Write service READMEs with start commands | Both | 15 min |

---

## Parallel Execution Map

```
Hour    Shaheer              Ali                     Hamza
─────   ─────────────────    ─────────────────────   ──────────────────────────
0-1     Finish DB setup      A1: Earnings scaffold   H1.1-H1.3: Anomaly scaffold
        Run seed script      A1.6: Auth dependency   H1.4-H1.6: Z-score + IQR

1-3     Fix seed issues      A2: Shift CRUD          H1.7-H1.11: Rolling + MoM +
        Verify views work    (create, list, get)      Sanity + Explainer + Detect
        Help with Prisma                              endpoint (NO DB NEEDED)
        introspection

3-5     Frontend setup       A3: CSV/Excel import    H2: Anomaly DB integration
        (React + Vite +      + Cloudinary upload     H3.1-H3.6: Grievance setup
        Tailwind scaffold)                            (Prisma, Express, auth)

5-7     Frontend: Auth       A4: Screenshot upload   H3.7-H3.12: Grievance CRUD
        pages (login,        + Verification flow     H4: Clusters + Stats
        register)

7-9     Frontend: Worker     A5: Trends + City       H5: Analytics Service
        dashboard + charts   median comparison       (all 5 endpoints)
                             A6: Certificate Svc

9-11    Frontend: Advocate   I1, I5: Integration     I2, I3, I6, I7, I8:
        panel + Grievance    testing                  Integration testing
        board

11-14   Polish, bug fixes,   I9, I10: Postman +      I9, I10: Postman +
        demo prep            READMEs                  READMEs
```

---

## Critical Path Items

These are the tasks that block other work. Prioritize them above all else.

1. **Shaheer: DB + Seed must be done by Hour 1** — Ali and Hamza both need tables to exist. Hamza's Anomaly `/detect` doesn't need DB, but Grievance and Analytics do.

2. **Ali: Earnings Shift CRUD (A2) must be done by Hour 3** — The Anomaly `/analyze-worker` and Certificate Service both call Earnings endpoints. Without basic CRUD, those services can't integrate.

3. **Ali: Earnings Summary endpoint (A5.1) must be done by Hour 8** — Certificate Service calls this. Ali should build Certificate immediately after.

4. **Hamza: Anomaly `/detect` (H1.11) must be done by Hour 3** — This is judge-tested. Get it working and tested with sample payloads early. Everything else can be buggy; this cannot.

5. **Shaheer: Prisma introspection must work by Hour 3** — Hamza needs `npx prisma db pull` to succeed before starting Grievance CRUD. Shaheer should verify this works before moving to frontend.

---

## Definition of Done (per service)

A service is "done" when:

- [ ] All endpoints return correct responses for valid inputs
- [ ] Auth validation rejects requests without valid Bearer token
- [ ] Role enforcement rejects wrong roles (e.g., worker can't access verification queue)
- [ ] Error responses use correct HTTP status codes (not everything is 500)
- [ ] Pagination works on list endpoints (page, limit, total, total_pages)
- [ ] README exists with start command
- [ ] Service starts with a single command and connects to the database