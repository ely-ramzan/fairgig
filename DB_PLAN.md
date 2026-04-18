# FairGig — Database Plan

## Database: PostgreSQL 16

### Why PostgreSQL

| Factor | PostgreSQL Advantage | MongoDB Alternative (rejected) |
|--------|---------------------|-------------------------------|
| **Data relationships** | Foreign keys enforce shift→worker, verification→shift, grievance→platform integrity. Bugs caught at DB level, not runtime. | No FK enforcement. A deleted worker leaves orphaned shifts silently. |
| **Financial data** | `DECIMAL(12,2)` — exact arithmetic for money. No floating point rounding errors causing fake verification discrepancies. | Doubles by default. `0.1 + 0.2 ≠ 0.3` causes phantom anomalies. |
| **Analytics queries** | Native `PERCENTILE_CONT`, `LAG`, `PERCENT_RANK`, `DATE_TRUNC`, CTEs, window functions. City-wide medians and MoM drops are single queries. | Aggregation pipelines are verbose, harder to debug, and lack percentile functions without workarounds. |
| **Anonymization** | Row-Level Security policies + views with `HAVING COUNT >= 5` enforce k-anonymity at the database layer. | Application-level enforcement only. One missed check = data leak. |
| **Full-text search** | `tsvector` + `plainto_tsquery` for grievance board search — no extra service needed. | Built-in text search exists but less mature for structured queries. |
| **Concurrent writes** | MVCC handles concurrent CSV imports and shift logging without explicit locking. | Document-level locking can cause contention on bulk imports. |

---

## Schema Overview

### Table Count: 10 tables + 1 view + 1 materialized view

```
users                 — All user accounts (worker, verifier, advocate)
city_zones            — Geographic zones for anonymized aggregation
platforms             — Gig platforms (Careem, Foodpanda, etc.)
shift_logs            — Individual shift entries (core data)
screenshots           — Cloudinary references for uploaded earnings screenshots
file_uploads          — Cloudinary references for imported CSV/Excel files
verifications         — Verifier decisions on shift_logs
grievances            — Worker complaints
grievance_tags        — Tags on grievances (separate table for query efficiency)
anomaly_results       — Cached anomaly detection output

zone_earnings_summary — VIEW: anonymized aggregates by zone/platform/week
monthly_worker_totals — MATERIALIZED VIEW: pre-computed monthly totals for MoM comparison
```

---

## Complete Schema

### 1. `city_zones`

```sql
CREATE TABLE city_zones (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,          -- e.g. "Gulberg", "DHA Phase 5"
    city        VARCHAR(100) NOT NULL DEFAULT 'Lahore',
    lat         DECIMAL(10, 7),
    lng         DECIMAL(10, 7),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Seed data: 5-6 Lahore zones
-- Gulberg, DHA, Johar Town, Model Town, Bahria Town, Cantt
```

**Why separate table instead of a string column on users:** Consistent zone names (no typos like "DHA" vs "dha" vs "Defence"), enables zone-level aggregation with GROUP BY, and the lat/lng can power a future map view.

---

### 2. `users`

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) NOT NULL UNIQUE,
    phone           VARCHAR(20),                  -- Pakistani format: +92XXXXXXXXXX
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('worker', 'verifier', 'advocate')),
    display_name    VARCHAR(100) NOT NULL,
    city_zone_id    UUID REFERENCES city_zones(id),
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_city_zone ON users(city_zone_id, role);
```

**Design decisions:**
- Single table for all three roles (not separate worker/verifier/advocate tables). JWT auth is simpler with one user table, and a verifier could theoretically also be a worker.
- `city_zone_id` is nullable — verifiers and advocates don't need a zone. Workers MUST have one (enforced at application level, not DB, to keep schema flexible).
- `password_hash` uses bcrypt with 12 salt rounds. Never stored as plaintext. Never returned in API responses.
- `display_name` is what appears on the grievance board and in verifier queues. Email and phone are private — only the user themselves can see these.

---

### 3. `platforms`

```sql
CREATE TABLE platforms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    category    VARCHAR(30) NOT NULL CHECK (category IN ('ride', 'delivery', 'freelance', 'domestic')),
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Seed: Careem (ride), Foodpanda (delivery), Uber (ride), InDriver (ride), Fiverr (freelance)
```

**Why a table instead of a string on shift_logs:** Platform names must be consistent for aggregation. If one worker types "Food Panda" and another types "foodpanda", the analytics break. A lookup table with a dropdown on the frontend eliminates this.

---

### 4. `shift_logs`

```sql
CREATE TABLE shift_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform_id             UUID NOT NULL REFERENCES platforms(id),
    shift_date              DATE NOT NULL,
    hours_worked            DECIMAL(5, 2) NOT NULL CHECK (hours_worked > 0),
    gross_earned            DECIMAL(12, 2) NOT NULL CHECK (gross_earned > 0),
    platform_deductions     DECIMAL(12, 2) NOT NULL CHECK (platform_deductions >= 0),
    net_received            DECIMAL(12, 2) NOT NULL CHECK (net_received >= 0),
    verification_status     VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (verification_status IN ('pending', 'verified', 'disputed', 'unverifiable')),
    import_source           VARCHAR(10) NOT NULL DEFAULT 'manual'
                            CHECK (import_source IN ('manual', 'csv')),
    file_upload_id          UUID REFERENCES file_uploads(id),  -- links to the CSV/Excel file if imported
    created_at              TIMESTAMP DEFAULT NOW(),

    -- Deduplication constraint
    CONSTRAINT uq_shift_entry UNIQUE (worker_id, platform_id, shift_date, gross_earned)
);

-- Primary access pattern: worker viewing their own shifts
CREATE INDEX idx_shifts_worker_date ON shift_logs(worker_id, shift_date DESC);

-- Analytics: aggregate by platform over time
CREATE INDEX idx_shifts_platform_date ON shift_logs(platform_id, shift_date);

-- Commission rate tracker: per worker per platform
CREATE INDEX idx_shifts_worker_platform_date ON shift_logs(worker_id, platform_id, shift_date);

-- Verifier queue: pending shifts with screenshots
CREATE INDEX idx_shifts_pending ON shift_logs(verification_status, created_at)
    WHERE verification_status = 'pending';

-- Monthly aggregation for vulnerability flags
CREATE INDEX idx_shifts_worker_month ON shift_logs(worker_id, (DATE_TRUNC('month', shift_date)));
```

**Design decisions:**
- `DECIMAL(12, 2)` for all money fields — exact arithmetic, never float. Max value: 9,999,999,999.99 which handles even annual totals.
- `DECIMAL(5, 2)` for hours — max 999.99 hours, which is more than enough for a single shift.
- `CHECK` constraints catch invalid data at DB level: negative hours, negative earnings, invalid status values.
- `UNIQUE (worker_id, platform_id, shift_date, gross_earned)` prevents exact duplicate entries from CSV imports. Note: same worker CAN have multiple shifts on the same date on the same platform (e.g., morning and evening shifts) as long as gross_earned differs.
- `ON DELETE CASCADE` on worker_id — if a worker account is deleted, their shift data goes too. This is intentional: we don't want orphaned records.
- `import_source` tracks whether the entry came from manual form entry or CSV bulk import.
- `file_upload_id` links to the original uploaded CSV/Excel file on Cloudinary (null for manual entries).
- Partial index on `verification_status = 'pending'` — the verifier queue only queries pending shifts, so this index is small and fast.

**Verification state machine:**
```
pending → verified     (verifier confirms)
pending → disputed     (verifier flags discrepancy)
pending → unverifiable (verifier can't determine from screenshot)
disputed → pending     (worker re-uploads screenshot — reset to pending)
verified → [FINAL]     (cannot be changed once verified)
```

---

### 5. `screenshots`

```sql
CREATE TABLE screenshots (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_log_id            UUID NOT NULL UNIQUE REFERENCES shift_logs(id) ON DELETE CASCADE,
    cloudinary_public_id    VARCHAR(255) NOT NULL,       -- Cloudinary public_id for transformations
    cloudinary_url          TEXT NOT NULL,                -- secure_url from Cloudinary (cached)
    original_filename       VARCHAR(255),                -- original file name from upload
    file_size_bytes         INTEGER,                     -- original file size
    width                   INTEGER,                     -- image dimensions
    height                  INTEGER,
    format                  VARCHAR(10),                 -- 'jpg', 'png', 'webp'
    uploaded_at             TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_screenshots_shift ON screenshots(shift_log_id);
```

**Design decisions:**
- `UNIQUE` on `shift_log_id` — one screenshot per shift. If a worker needs to re-upload (after dispute), the old record is replaced (UPDATE, not INSERT).
- Store `cloudinary_public_id` separately from `cloudinary_url`. The URL is a cached convenience — the `public_id` is the source of truth. To generate thumbnails for the verifier queue: construct URL from `public_id` with transformation parameters (`c_thumb,w_300,h_200`).
- Store `width`, `height`, `format` — returned by Cloudinary on upload. Useful for the verifier UI to size the image container before loading.
- `file_size_bytes` — useful for tracking storage usage and enforcing the 5MB upload limit.

**Cloudinary upload configuration:**
```python
cloudinary.uploader.upload(
    file,
    folder=f"fairgig/screenshots/{worker_id}",
    public_id=f"{shift_log_id}",
    resource_type="image",
    allowed_formats=["jpg", "png", "jpeg"],
    max_file_size=5_000_000,
    transformation=[
        {"width": 1200, "crop": "limit"},
        {"quality": "auto:good"}
    ]
)
```

---

### 6. `file_uploads`

```sql
CREATE TABLE file_uploads (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cloudinary_public_id    VARCHAR(255) NOT NULL,
    cloudinary_url          TEXT NOT NULL,
    original_filename       VARCHAR(255) NOT NULL,        -- e.g. "march_earnings.csv"
    file_type               VARCHAR(10) NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'xls')),
    file_size_bytes         INTEGER,
    rows_imported           INTEGER DEFAULT 0,            -- how many rows were successfully imported
    rows_skipped            INTEGER DEFAULT 0,            -- duplicates or invalid rows
    rows_errored            INTEGER DEFAULT 0,            -- rows with errors
    import_status           VARCHAR(20) NOT NULL DEFAULT 'processing'
                            CHECK (import_status IN ('processing', 'completed', 'failed')),
    error_summary           JSONB,                        -- [{row: 5, reason: "invalid date"}, ...]
    uploaded_at             TIMESTAMP DEFAULT NOW(),
    processed_at            TIMESTAMP
);

CREATE INDEX idx_file_uploads_worker ON file_uploads(worker_id, uploaded_at DESC);
```

**Design decisions:**
- This table archives every CSV/Excel file a worker imports. The actual file lives on Cloudinary — this table stores the reference and import metadata.
- `rows_imported`, `rows_skipped`, `rows_errored` — the worker can see a history of their imports with success/failure counts.
- `error_summary` as JSONB — stores row-level error details without needing a separate errors table. Structure: `[{row: 5, reason: "invalid date format"}, {row: 12, reason: "platform 'Grab' not found"}]`.
- `import_status` tracks whether the file is still being processed, completed successfully, or failed entirely.
- `processed_at` — when the import finished. Combined with `uploaded_at`, this shows processing duration.

**Cloudinary upload for CSV/Excel:**
```python
cloudinary.uploader.upload(
    file,
    folder=f"fairgig/imports/{worker_id}",
    public_id=f"{import_id}",
    resource_type="raw",                    # not "image" — raw file upload
    allowed_formats=["csv", "xlsx", "xls"],
    max_file_size=10_000_000               # 10MB for spreadsheets
)
```

**Why archive CSV/Excel files?**
- Audit trail: if a dispute arises about imported data, the original file is available.
- Re-processing: if the import logic is updated (e.g., better date parsing), old files can be re-imported.
- Judges will appreciate the thoroughness.

---

### 7. `verifications`

```sql
CREATE TABLE verifications (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_log_id            UUID NOT NULL REFERENCES shift_logs(id) ON DELETE CASCADE,
    verifier_id             UUID NOT NULL REFERENCES users(id),
    status                  VARCHAR(20) NOT NULL
                            CHECK (status IN ('confirmed', 'disputed', 'unverifiable')),
    notes                   TEXT,                         -- required for disputed/unverifiable
    verifier_gross          DECIMAL(12, 2),               -- what the verifier reads from screenshot
    verifier_deductions     DECIMAL(12, 2),               -- what the verifier reads from screenshot
    verified_at             TIMESTAMP DEFAULT NOW(),

    -- One verification per shift (re-verification replaces the old one)
    CONSTRAINT uq_verification_per_shift UNIQUE (shift_log_id)
);

CREATE INDEX idx_verifications_verifier ON verifications(verifier_id, verified_at DESC);
CREATE INDEX idx_verifications_status ON verifications(status);
```

**Design decisions:**
- `UNIQUE (shift_log_id)` — one active verification per shift. If a disputed shift is re-submitted, the old verification is deleted and a new one created.
- `verifier_gross` and `verifier_deductions` are separate from the worker's claimed values in `shift_logs`. This enables discrepancy calculation: `worker.gross_earned - verifier.verifier_gross`.
- `notes` is required for disputed/unverifiable (enforced at application level) — the verifier must explain why.
- These fields are nullable because for a "confirmed" verification, the verifier is saying "yes, the worker's claimed values match the screenshot" — they don't need to re-enter the numbers.

---

### 8. `grievances`

```sql
CREATE TABLE grievances (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform_id     UUID NOT NULL REFERENCES platforms(id),
    category        VARCHAR(30) NOT NULL
                    CHECK (category IN ('commission_change', 'deactivation', 'payment_delay',
                                        'unfair_rating', 'safety', 'other')),
    description     TEXT NOT NULL CHECK (char_length(description) >= 10),
    status          VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'escalated', 'resolved')),
    is_anonymous    BOOLEAN NOT NULL DEFAULT TRUE,
    resolution_notes TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Full-text search index
CREATE INDEX idx_grievances_fts ON grievances USING GIN (to_tsvector('english', description));

-- Advocate dashboard filters
CREATE INDEX idx_grievances_platform_category ON grievances(platform_id, category, created_at DESC);

-- Active grievances queue
CREATE INDEX idx_grievances_open ON grievances(status, created_at DESC)
    WHERE status IN ('open', 'escalated');

-- Clustering query
CREATE INDEX idx_grievances_cluster ON grievances(platform_id, category, created_at);
```

**Design decisions:**
- `CHECK (char_length(description) >= 10)` — prevents empty or trivially short complaints.
- `is_anonymous` defaults to `TRUE` — privacy by default. The application layer replaces `worker_display_name` with "Anonymous" when this is true.
- `resolution_notes` — filled when an advocate resolves the grievance.
- GIN index on `to_tsvector` — enables full-text search on the grievance board. Query: `WHERE to_tsvector('english', description) @@ plainto_tsquery('english', 'commission increase')`.
- Partial index on `status IN ('open', 'escalated')` — the active queue is much smaller than the full table, so this index is fast.

---

### 9. `grievance_tags`

```sql
CREATE TABLE grievance_tags (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grievance_id    UUID NOT NULL REFERENCES grievances(id) ON DELETE CASCADE,
    tag             VARCHAR(50) NOT NULL,

    CONSTRAINT uq_grievance_tag UNIQUE (grievance_id, tag)
);

CREATE INDEX idx_tags_grievance ON grievance_tags(grievance_id);
CREATE INDEX idx_tags_tag ON grievance_tags(tag);
```

**Why a separate table instead of JSONB array on grievances:**
- Querying by tag: `SELECT g.* FROM grievances g JOIN grievance_tags t ON ... WHERE t.tag = 'commission_issue'` is faster than JSONB containment (`@>`) and uses a simple B-tree index.
- Tag frequency analysis: `SELECT tag, COUNT(*) FROM grievance_tags GROUP BY tag ORDER BY COUNT(*) DESC` — gives trending tags for the advocate dashboard.
- `UNIQUE (grievance_id, tag)` prevents duplicate tags.
- `ON DELETE CASCADE` — deleting a grievance removes its tags automatically.

---

### 10. `anomaly_results`

```sql
CREATE TABLE anomaly_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shift_log_id    UUID REFERENCES shift_logs(id) ON DELETE SET NULL,
    anomaly_type    VARCHAR(30) NOT NULL
                    CHECK (anomaly_type IN ('unusual_deduction', 'income_drop', 'rate_spike',
                                            'hours_mismatch', 'mom_drop')),
    severity        VARCHAR(10) NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
    metric_name     VARCHAR(50),              -- e.g. "commission_rate", "hourly_rate"
    expected_low    DECIMAL(12, 2),
    expected_high   DECIMAL(12, 2),
    actual_value    DECIMAL(12, 2),
    deviation_score DECIMAL(6, 2),            -- Z-score or IQR multiple
    explanation     TEXT NOT NULL,             -- human-readable explanation
    detected_at     TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_anomaly_worker ON anomaly_results(worker_id, detected_at DESC);
CREATE INDEX idx_anomaly_severity ON anomaly_results(severity, detected_at DESC);
CREATE INDEX idx_anomaly_type ON anomaly_results(anomaly_type);
```

**Design decisions:**
- `shift_log_id` uses `ON DELETE SET NULL` (not CASCADE) — if the shift is deleted, we keep the anomaly record for historical analysis.
- `expected_low`/`expected_high` — the normal range that was computed. Combined with `actual_value`, this lets the frontend show a visual range indicator.
- `deviation_score` — how many standard deviations (Z-score) or IQR multiples the value was from normal.
- `explanation` — the pre-generated human-readable explanation. Stored so it doesn't need re-computation on every page load.
- This table is a cache — the Anomaly Service writes here after running detection. The worker dashboard reads from here. Re-running detection replaces old results.

---

## Views

### `zone_earnings_summary` (Regular View)

```sql
CREATE VIEW zone_earnings_summary AS
SELECT
    u.city_zone_id,
    cz.name AS zone_name,
    sl.platform_id,
    p.name AS platform_name,
    DATE_TRUNC('week', sl.shift_date) AS week,
    COUNT(*) AS total_shifts,
    COUNT(DISTINCT sl.worker_id) AS worker_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY sl.net_received) AS median_net,
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY sl.net_received) AS p25_net,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY sl.net_received) AS p75_net,
    AVG(sl.net_received) AS avg_net,
    AVG(sl.platform_deductions / NULLIF(sl.gross_earned, 0)) * 100 AS avg_commission_rate,
    AVG(sl.net_received / NULLIF(sl.hours_worked, 0)) AS avg_hourly_rate
FROM shift_logs sl
JOIN users u ON sl.worker_id = u.id
JOIN city_zones cz ON u.city_zone_id = cz.id
JOIN platforms p ON sl.platform_id = p.id
WHERE sl.verification_status = 'verified'
GROUP BY u.city_zone_id, cz.name, sl.platform_id, p.name, DATE_TRUNC('week', sl.shift_date)
HAVING COUNT(DISTINCT sl.worker_id) >= 5;
```

**k-Anonymity enforcement:** `HAVING COUNT(DISTINCT sl.worker_id) >= 5` ensures no aggregate is computed from fewer than 5 distinct workers. This prevents identifying an individual's earnings from a small group. The Analytics Service queries ONLY this view — never raw `shift_logs`.

### `monthly_worker_totals` (Materialized View)

```sql
CREATE MATERIALIZED VIEW monthly_worker_totals AS
SELECT
    worker_id,
    DATE_TRUNC('month', shift_date) AS month,
    SUM(net_received) AS total_net,
    SUM(gross_earned) AS total_gross,
    SUM(hours_worked) AS total_hours,
    COUNT(*) AS shift_count,
    AVG(platform_deductions / NULLIF(gross_earned, 0)) * 100 AS avg_commission_rate
FROM shift_logs
GROUP BY worker_id, DATE_TRUNC('month', shift_date);

CREATE UNIQUE INDEX idx_monthly_worker ON monthly_worker_totals(worker_id, month);

-- Refresh daily (or on-demand after bulk imports)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_worker_totals;
```

**Why materialized?** The vulnerability flag query (workers with >20% MoM income drop) uses `LAG()` over this view. Computing monthly totals on-the-fly for 200+ workers is expensive. The materialized view pre-computes it and refreshes daily (or after seed/import operations).

---

## Row-Level Security

```sql
-- Enable RLS on shift_logs
ALTER TABLE shift_logs ENABLE ROW LEVEL SECURITY;

-- Workers can only see their own shifts
CREATE POLICY worker_own_shifts ON shift_logs
    FOR SELECT
    USING (
        worker_id = current_setting('app.current_user_id')::uuid
        OR current_setting('app.current_role') IN ('verifier', 'advocate')
    );

-- Set these in each database session from the JWT payload:
-- SET LOCAL app.current_user_id = '{user_id}';
-- SET LOCAL app.current_role = '{role}';
```

**Judge-friendly talking point:** RLS is a defense-in-depth measure. Even if application code has a bug that forgets to filter by `worker_id`, the database itself prevents data leakage.

---

## Seed Script Expectations

```
city_zones:     6 zones (Gulberg, DHA, Johar Town, Model Town, Bahria Town, Cantt)
platforms:      5 platforms (Careem, Foodpanda, Uber, InDriver, Fiverr)
users:          200+ workers, 10 verifiers, 5 advocates
shift_logs:     ~8,000 entries (200 workers × ~40 shifts over 3 months)
screenshots:    ~3,000 (not every shift has a screenshot)
verifications:  ~2,400 (60% verified, 10% disputed, 5% unverifiable)
grievances:     60+ complaints with realistic clustering
grievance_tags: 120+ tags
anomaly_results: 40+ pre-computed anomalies
file_uploads:   10-15 sample CSV imports

Distribution notes:
- Careem commission: 20-25% (normal), spike to 30% in week 8 (triggers anomaly)
- DHA workers earn ~15% more than Johar Town (zone-level difference)
- 5 workers have >20% MoM income drops (vulnerability flags)
- 10+ workers filed commission_change complaints about Careem in the same week (cluster)
```
