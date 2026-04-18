# FairGig — Implementation Plan
## Sequence-first, conflict-aware. Updated 2026-04-19.

---

## Current State (What's Already Built & Tested)

| Service | Port | Tests | Status |
|---------|------|-------|--------|
| Auth Service | 8001 | (Shaheer — pre-existing) | ✅ Running |
| Earnings Service | 8002 | 219 / 219 ✅ | Complete |
| Anomaly Service | 8003 | 157 / 158 ⚠️ | 1 minor failure |
| Grievance Service | 8004 | 96 / 96 ✅ | Complete (uses Joi) |
| Analytics Service | 8005 | 66 / 66 ✅ | Complete |
| Certificate Service | 8006 | 34 / 34 ✅ | Complete |

**Total tests passing: 572 / 573**

---

## ⚠️ Bugs Found — Fix Before Integration

These are real conflicts between what the code does and what PRV2.md requires.
**Do not start integration testing until these are resolved.**

---

### BUG 1 — CRITICAL: State machine missing `unverifiable → pending` transition
**File:** `services/earnings/app/services/verification_service.py`

**Current code:**
```python
VALID_TRANSITIONS = {
    "pending":      ["verified", "disputed", "unverifiable"],
    "disputed":     ["pending"],
    "verified":     [],
    "unverifiable": [],   # ← WRONG — should allow pending
}
```

**PRV2 requires (Section 4.2):**
```
unverifiable → pending  (worker re-uploads — resets for re-review)
```

**Fix:** Add `"pending"` to `unverifiable` transitions.
**Risk:** The existing test `test_unverifiable_is_final_no_transitions` in `test_screenshots_verification.py`
will break — it must be updated to reflect the correct spec.

---

### BUG 2 — CRITICAL: Screenshot re-upload only resets `disputed`, not `unverifiable`
**File:** `services/earnings/app/routes/screenshots.py` (line 64)

**Current code:**
```python
if shift.verification_status == "disputed":
    shift.verification_status = "pending"
```

**PRV2 requires:** Both `disputed` and `unverifiable` should reset to `pending` when the worker
re-uploads a screenshot.

**Fix:** Change condition to:
```python
if shift.verification_status in ("disputed", "unverifiable"):
    shift.verification_status = "pending"
```

**Risk:** Update the existing test `test_pending_shift_status_unchanged` to also add a test for
`unverifiable → pending` reset on re-upload.

---

### BUG 3 — MINOR: Anomaly sanity test failure
**File:** `services/anomaly/tests/test_sanity.py`
**Test:** `TestMinimumWageCheck::test_below_minimum_type_is_rate_spike`

The test expects `type="rate_spike"` for below-minimum wage detection, but the sanity engine
returns a different anomaly type. This is a 1-line fix in either the engine or the test —
needs investigation before deciding which is wrong.

---

### NON-BREAKING GAPS (document, don't block)

| Gap | Location | PRV2 Reference | Impact |
|-----|----------|----------------|--------|
| `shared/validators/` module doesn't exist | Entire project | Section 6.2–6.4 | No service imports it currently — skip for now |
| CSV validation simplified | `earnings/app/services/import_service.py` | Section 7.2 | Missing: formula injection, null-like values, European decimal, 10 MB size limit, `csv.Sniffer` delimiter detection, duplicate header check |
| Grievance uses Joi, not Zod | `grievance/src/validators/` | Section 6.1 | **Not a bug** — user confirmed Joi is fine |
| `shifts-raw` endpoint undocumented | `earnings/app/routes/shifts.py` | Section 12 shows 12 endpoints | Internal endpoint, used by Anomaly — works correctly, just not in PRV2 count |
| Certificate template missing watermark + signature line | `certificate/templates/certificate.html` | Section 4.4 | Visual polish only |
| `GET /api/earnings/shifts/:id` only allows worker role | PRV2 Section 12 shows `worker, verifier` | Minor — verifier should be able to see shifts |

---

## Implementation Sequence

Work in this exact order. Each step depends on the previous.

---

### STEP 1 — Fix Bug 1 + Bug 2 (State machine + screenshot reset)
**Owner:** Ali | **Time:** 20 min | **Files:** 2

1. `verification_service.py` — add `"pending"` to `unverifiable` transitions
2. `screenshots.py` — extend reset condition to cover `unverifiable`
3. Update affected tests in `test_screenshots_verification.py`
4. Run `pytest services/earnings/` — must be 219+/219+

---

### STEP 2 — Fix Bug 3 (Anomaly sanity test)
**Owner:** Hamza | **Time:** 10 min | **Files:** 1

1. Read `services/anomaly/app/engine/sanity.py` + `tests/test_sanity.py`
2. Decide: is the engine wrong (fix engine) or is the test wrong (fix test)?
3. Run `pytest services/anomaly/` — must be 158/158

---

### STEP 3 — Verify all 6 services start cleanly
**Owner:** Both | **Time:** 15 min

Run each service against the real DB and confirm `/health` responds:

```bash
# Terminal 1
cd services/auth && uvicorn app.main:app --port 8001 --reload

# Terminal 2
cd services/earnings && uvicorn app.main:app --port 8002 --reload

# Terminal 3
cd services/anomaly && uvicorn app.main:app --port 8003 --reload

# Terminal 4
cd services/grievance && npm start   # port 8004

# Terminal 5
cd services/analytics && uvicorn app.main:app --port 8005 --reload

# Terminal 6
cd services/certificate && uvicorn app.main:app --port 8006 --reload
```

Expected for each:
```bash
curl http://localhost:800X/health
# {"status": "ok", "service": "X"}
```

**Blockers to watch:**
- `asyncpg.exceptions.InvalidPasswordError` — wrong DB creds in `.env`
- `asyncpg.exceptions.UndefinedTableError` — Alembic migrations not run
- `@prisma/client not found` — `cd services/grievance && npx prisma generate`
- `ModuleNotFoundError` — `pip install -r requirements.txt` in each service dir

---

### STEP 4 — Seed the database
**Owner:** Shaheer | **Time:** 10 min (already done if DB is live)

```bash
cd seed && python seed.py
```

Verify key distributions:
```sql
-- Should return ~8000 rows
SELECT COUNT(*) FROM shift_logs;

-- Should show Careem commission spike ~30% in week 8
SELECT DATE_TRUNC('week', shift_date) AS week,
       AVG(platform_deductions / NULLIF(gross_earned,0)) * 100 AS avg_commission
FROM shift_logs sl
JOIN platforms p ON sl.platform_id = p.id
WHERE p.name = 'Careem'
GROUP BY week ORDER BY week;

-- zone_earnings_summary view must return rows (k-anonymity: >=5 workers)
SELECT COUNT(*) FROM zone_earnings_summary;
-- If 0, seed needs more verified shifts (see Known Issues in PRV2)
```

---

### STEP 5 — Integration: Auth validation across all services
**Owner:** Both | **Time:** 15 min | **PRV2 I4**

Get a real worker token from Auth Service:
```bash
curl -X POST http://localhost:8001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "worker@test.com", "password": "password"}'
# Save the access_token
```

Test each service rejects invalid tokens:
```bash
# Should 401/403 — no token
curl http://localhost:8002/api/earnings/shifts
curl http://localhost:8003/api/anomaly/results/some-uuid
curl http://localhost:8005/api/analytics/commission-trends

# Should 200 — with token
curl -H "Authorization: Bearer $TOKEN" http://localhost:8002/api/earnings/shifts
```

---

### STEP 6 — Integration: Earnings ↔ Anomaly
**Owner:** Hamza | **Time:** 15 min | **PRV2 I2**

The Anomaly `/analyze-worker` calls Earnings `/worker/:id/shifts-raw`.

```bash
# With a worker token that has actual shift data
curl -X POST http://localhost:8003/api/anomaly/analyze-worker \
  -H "Authorization: Bearer $WORKER_TOKEN"
# Expected: {"anomalies_cached": N, "anomalies": [...]}

# Then verify cached results are retrievable
curl -H "Authorization: Bearer $WORKER_TOKEN" \
  http://localhost:8003/api/anomaly/results/$WORKER_ID
```

**Failure mode to watch:** If Earnings returns 401 for the inter-service call, the Anomaly
service is forwarding the user's token correctly — check that the Earnings `/shifts-raw`
endpoint accepts any authenticated user (it does — uses `get_current_user`, not `require_role`).

---

### STEP 7 — Integration: Earnings ↔ Certificate
**Owner:** Ali | **Time:** 15 min | **PRV2 I1**

```bash
# With a worker token
curl "http://localhost:8006/api/certificate/preview?date_from=2026-01-01&date_to=2026-03-31" \
  -H "Authorization: Bearer $WORKER_TOKEN"
# Expected: {"cert_id":"...", "total_gross":"...", "shift_count": N, ...}

curl "http://localhost:8006/api/certificate/generate?date_from=2026-01-01&date_to=2026-03-31" \
  -H "Authorization: Bearer $WORKER_TOKEN" -o certificate.html
# Open certificate.html in browser → should render with real data
```

---

### STEP 8 — Integration: Analytics reads seeded data
**Owner:** Hamza | **Time:** 15 min | **PRV2 I3**

```bash
# Get an advocate token
curl -X POST http://localhost:8001/api/auth/login \
  -d '{"email": "advocate@test.com", "password": "password"}' \
  -H "Content-Type: application/json"

# Dashboard summary (parallel queries via asyncio.gather)
curl -H "Authorization: Bearer $ADVOCATE_TOKEN" \
  http://localhost:8005/api/analytics/dashboard-summary

# Vulnerability flags — should show 5 workers with >20% MoM drops
curl -H "Authorization: Bearer $ADVOCATE_TOKEN" \
  http://localhost:8005/api/analytics/vulnerability-flags

# Commission trends — should show Careem spike in week 8
curl -H "Authorization: Bearer $ADVOCATE_TOKEN" \
  http://localhost:8005/api/analytics/commission-trends
```

---

### STEP 9 — Full end-to-end workflow
**Owner:** Both | **Time:** 30 min | **PRV2 I5**

```bash
BASE_E=http://localhost:8002
BASE_C=http://localhost:8006
TOKEN=$WORKER_TOKEN

# 1. Get platforms
PLATFORM_ID=$(curl -s -H "Authorization: Bearer $TOKEN" \
  $BASE_E/api/earnings/platforms | python -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

# 2. Create shift
SHIFT=$(curl -s -X POST $BASE_E/api/earnings/shifts \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"platform_id\":\"$PLATFORM_ID\",\"shift_date\":\"2026-03-01\",
       \"hours_worked\":6,\"gross_earned\":2500,
       \"platform_deductions\":550,\"net_received\":1950}")
SHIFT_ID=$(echo $SHIFT | python -c "import sys,json; print(json.load(sys.stdin)['id'])")
WORKER_ID=$(echo $SHIFT | python -c "import sys,json; print(json.load(sys.stdin)['worker_id'])")

# 3. Upload screenshot (use any PNG)
curl -X POST $BASE_E/api/earnings/shifts/$SHIFT_ID/screenshot \
  -H "Authorization: Bearer $TOKEN" -F "file=@screenshot.png"

# 4. Verify as verifier
curl -X POST $BASE_E/api/earnings/shifts/$SHIFT_ID/verify \
  -H "Authorization: Bearer $VERIFIER_TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"verified","notes":"Confirmed"}'

# 5. Check trends
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_E/api/earnings/worker/$WORKER_ID/trends?months=3"

# 6. Generate certificate
curl "$BASE_C/api/certificate/generate?date_from=2026-01-01&date_to=2026-03-31" \
  -H "Authorization: Bearer $TOKEN" -o certificate.html
```

---

### STEP 10 — Judge-tested endpoint: Anomaly /detect
**Owner:** Hamza | **Time:** 10 min | **PRV2 I6**

This is the most important endpoint for judges. Test with the exact PRV2 sample payload:

```bash
curl -X POST http://localhost:8003/api/anomaly/detect \
  -H "Content-Type: application/json" \
  -d '{
    "earnings": [
      {"shift_date":"2026-01-15","platform":"Careem","gross_earned":2500,
       "platform_deductions":550,"net_received":1950,"hours_worked":6},
      {"shift_date":"2026-01-16","platform":"Careem","gross_earned":2300,
       "platform_deductions":506,"net_received":1794,"hours_worked":5.5},
      {"shift_date":"2026-01-17","platform":"Careem","gross_earned":2400,
       "platform_deductions":528,"net_received":1872,"hours_worked":6},
      {"shift_date":"2026-01-18","platform":"Careem","gross_earned":2600,
       "platform_deductions":780,"net_received":1820,"hours_worked":7},
      {"shift_date":"2026-01-19","platform":"Careem","gross_earned":2200,
       "platform_deductions":484,"net_received":1716,"hours_worked":5}
    ]
  }'
# Entry 4 has 30% commission vs ~22% average → must trigger unusual_deduction anomaly

# Edge cases
curl -X POST http://localhost:8003/api/anomaly/detect \
  -H "Content-Type: application/json" -d '{"earnings": []}'
# Expected: {anomalies_found: 0, summary: "..."}

curl -X POST http://localhost:8003/api/anomaly/detect \
  -H "Content-Type: application/json" -d '{"earnings": [{...}, {...}]}'
# 2 entries → {anomalies_found: 0} (insufficient data)
```

---

### STEP 11 — Grievance clustering
**Owner:** Hamza | **Time:** 10 min | **PRV2 I7**

```bash
curl -H "Authorization: Bearer $ADVOCATE_TOKEN" \
  "http://localhost:8004/api/grievances/clusters?days=60&min_cluster_size=3"
# Should return Careem + commission_change cluster with count >= 10
```

---

### STEP 12 — Postman collection
**Owner:** Both | **Time:** 20 min | **PRV2 I9**

Export all 38 endpoints into a single Postman collection.
Save to `docs/POSTMAN_COLLECTION.json`.

Collection variables to pre-configure:
- `{{base_auth}}` = `http://localhost:8001`
- `{{base_earnings}}` = `http://localhost:8002`
- `{{base_anomaly}}` = `http://localhost:8003`
- `{{base_grievance}}` = `http://localhost:8004`
- `{{base_analytics}}` = `http://localhost:8005`
- `{{base_certificate}}` = `http://localhost:8006`
- `{{worker_token}}`, `{{verifier_token}}`, `{{advocate_token}}`

---

### STEP 13 — READMEs
**Owner:** Both | **Time:** 15 min | **PRV2 I10**

Each service README must include:
1. Single start command
2. Environment variables required
3. Endpoint list with method + path

---

## Quick Conflict Reference

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | 🔴 Critical | `verification_service.py` | `unverifiable → pending` missing | Add to VALID_TRANSITIONS |
| 2 | 🔴 Critical | `screenshots.py` line 64 | Only resets `disputed`, not `unverifiable` | Extend condition |
| 3 | 🟡 Minor | `anomaly/tests/test_sanity.py` | 1 test fails (`rate_spike` type mismatch) | Fix engine or test |
| 4 | 🟢 OK | `grievance/validators/` | Uses Joi not Zod | Confirmed acceptable |
| 5 | 🟢 OK | `earnings/app/services/import_service.py` | CSV validation simpler than spec | Non-blocking for demo |
| 6 | 🟢 OK | `certificate/templates/certificate.html` | Missing watermark + signature line | Visual polish only |

---

## Start Commands (all services)

```bash
# DB must be up first
cd services/auth     && uvicorn app.main:app --port 8001 --reload &
cd services/earnings && uvicorn app.main:app --port 8002 --reload &
cd services/anomaly  && uvicorn app.main:app --port 8003 --reload &
cd services/grievance && npm start &                                 # port 8004
cd services/analytics && uvicorn app.main:app --port 8005 --reload &
cd services/certificate && uvicorn app.main:app --port 8006 --reload &
```

Health check all:
```bash
for port in 8001 8002 8003 8004 8005 8006; do
  echo -n "Port $port: "
  curl -s http://localhost:$port/health | python -c "import sys,json; d=json.load(sys.stdin); print(d['status'], '-', d['service'])"
done
```

---

## Definition of Done

- [ ] Bug 1 fixed + tests updated (state machine)
- [ ] Bug 2 fixed + tests updated (screenshot reset)
- [ ] Bug 3 fixed (anomaly sanity test)
- [ ] All 6 services start without errors against real DB
- [ ] Seed data verified (8k shifts, zone_earnings_summary returns rows)
- [ ] Auth token rejection confirmed on all services
- [ ] Anomaly /detect returns correct anomaly for sample payload
- [ ] Full workflow: shift → screenshot → verify → certificate renders
- [ ] Grievance cluster visible with seeded data
- [ ] Postman collection exported (38 endpoints)
- [ ] READMEs written for all 6 services
