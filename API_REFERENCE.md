# FairGig — Complete API Reference

> **Base URLs**
> | Service | Port | Base |
> |---|---|---|
> | Auth | 8001 | `http://localhost:8001` |
> | Earnings | 8002 | `http://localhost:8002` |
> | Anomaly | 8003 | `http://localhost:8003` |
> | Grievance | 8004 | `http://localhost:8004` |
> | Certificate | 8006 | `http://localhost:8006` |

> **Authentication**  
> All protected endpoints require:  
> ```
> Authorization: Bearer <access_token>
> ```
> Tokens are obtained from `POST /api/auth/login` or `POST /api/auth/register`.

---

## Legend

| Symbol | Meaning |
|---|---|
| 🔓 | No auth required — public endpoint |
| 🔑 | Auth required — any authenticated role |
| 👷 | Auth required — `worker` only |
| ✅ | Auth required — `verifier` only |
| 📣 | Auth required — `advocate` only |
| 🔑✅📣 | Auth required — `worker`, `verifier`, or `advocate` |

---

## 1. Auth Service — Port 8001

### `GET /health` 🔓
Health check.

---

### `POST /api/auth/register` 🔓
Register a new user account.

**Body (JSON)**
```json
{
  "email": "ali@example.com",
  "password": "min8chars",
  "display_name": "Ali Hassan",
  "role": "worker",
  "phone": "+923001234567",
  "city_zone_id": "uuid"
}
```
- `role`: `"worker"` | `"verifier"` | `"advocate"`
- `city_zone_id`: required when `role = "worker"`

**Returns** `201` — `{ user, access_token, refresh_token }`

---

### `POST /api/auth/login` 🔓
Login with email + password.

**Body**
```json
{ "email": "ali@example.com", "password": "mypassword" }
```
**Returns** `200` — `{ access_token, refresh_token }`

---

### `POST /api/auth/refresh` 🔓
Get a new access token using a refresh token.

**Body**
```json
{ "refresh_token": "<token>" }
```
**Returns** `200` — `{ access_token, refresh_token }`

---

### `GET /api/auth/me` 🔑
Get the currently authenticated user's profile.

**Returns** `{ id, email, display_name, role, phone, city_zone_id, city_zone_name, created_at }`

---

### `GET /api/auth/validate` 🔑
**Internal** — called by other services to verify a JWT.  
Returns `{ user_id, role, city_zone_id }` if the token is valid.

---

### `GET /api/auth/city-zones` 🔓
List all available city zones (for the registration dropdown).

**Returns** `[{ id, name, city }]`

---

## 2. Earnings Service — Port 8002

### `GET /health` 🔓
Health check.

---

### `POST /api/earnings/shifts` 👷
Manually log a single shift.

**Body (JSON)**
```json
{
  "platform_id": "uuid",
  "shift_date": "2026-04-01",
  "hours_worked": "6.5",
  "gross_earned": "2100.00",
  "platform_deductions": "315.00",
  "net_received": "1785.00"
}
```
- `platform_id`: must be a valid UUID matching a row in `platforms`
- `shift_date`: cannot be in the future
- `hours_worked`: `0 < x ≤ 24`
- `gross_earned`: `> 0`
- `platform_deductions`: `≥ 0`, cannot exceed `gross_earned`
- `net_received`: must be within 2% of `gross - deductions`

**Returns** `201` — shift object

---

### `GET /api/earnings/shifts` 🔑
List the authenticated worker's own shifts (paginated).

**Query Params**
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1–100 | 20 | |
| `platform_id` | UUID | — | filter by platform |
| `status` | string | — | `pending` \| `verified` \| `disputed` \| `unverifiable` |
| `date_from` | date | — | `YYYY-MM-DD` |
| `date_to` | date | — | `YYYY-MM-DD` |

**Returns** `{ items[], total, page, limit, total_pages }`

---

### `GET /api/earnings/shifts/{shift_id}` 🔑
Get a single shift by UUID.  
Workers can only access their own shifts. Verifiers/advocates can access any.

---

### `POST /api/earnings/shifts/import` 👷
Import shifts from a CSV or Excel file.

**Body** — `multipart/form-data`
- `file`: `.csv` or `.xlsx`, max 10 MB, max 5 000 data rows

**File validation rules:**
- Extension must be `.csv` or `.xlsx`
- Max 10 MB
- Max 5 000 data rows
- Duplicate column headers → rejected
- Missing required columns → rejected
- Formula injection (leading `=`, `+`, `@`) → row skipped with error
- Null-like values (`N/A`, `-`, `null`, `?`) → treated as missing
- European decimal format (`1.200,50`) and currency prefix (`PKR 1200`) → normalised

**Returns** `201` — `{ upload_id, rows_imported, rows_errored, errors[] }`

---

### `GET /api/earnings/imports` 🔑
List the authenticated user's file import history.

**Returns** `[{ id, original_filename, file_type, rows_imported, rows_errored, import_status, uploaded_at }]`

---

### `GET /api/earnings/platforms` 🔑
List all available gig platforms.

**Returns** `[{ id, name, category }]`

---

### `POST /api/earnings/shifts/{shift_id}/screenshot` 👷
Upload an earnings screenshot (JPEG or PNG) for a shift.  
If the shift is in `disputed` or `unverifiable` state, it is automatically reset to `pending`.  
Replaces any existing screenshot.

**Body** — `multipart/form-data`
- `file`: JPEG or PNG image

**Returns** `201` — `{ id, shift_log_id, url, original_filename, file_size_bytes, width, height, format }`

---

### `GET /api/earnings/shifts/{shift_id}/screenshot` 🔑
Get the screenshot URL for a shift.

**Query Params**
| Param | Type | Default | Notes |
|---|---|---|---|
| `thumbnail` | bool | false | Returns a 200×200 cropped Cloudinary URL |

**Returns** `{ url, original_filename }`

---

### `GET /api/earnings/verification-queue` ✅
Paginated list of all `pending` shifts waiting for verification.

**Query Params** — `page` (≥1), `limit` (1–50, default 20)

**Returns** `{ items[], total, page, limit, total_pages }`

---

### `POST /api/earnings/shifts/{shift_id}/verify` ✅
Verifier submits a decision on a shift.

**Body (JSON)**
```json
{
  "status": "verified",
  "notes": "Screenshot matches claimed amount",
  "verifier_gross": "2100.00",
  "verifier_deductions": "315.00"
}
```
- `status`: `"verified"` | `"disputed"` | `"unverifiable"`
- Valid state transitions: `pending → verified/disputed/unverifiable`, `disputed/unverifiable → pending`

**Returns** — updated shift object

---

### `GET /api/earnings/worker/{worker_id}/shifts-raw` 🔑
**Internal** — called by the Anomaly Service.  
Returns all shifts for a worker in the format expected by the anomaly engine.

**Returns** `[{ shift_date, platform, gross_earned, platform_deductions, net_received, hours_worked }]`

---

### `GET /api/earnings/worker/{worker_id}/summary` 🔑
Aggregate earnings summary for a worker.  
Workers can only access their own data.

**Query Params** — `date_from`, `date_to` (optional, `YYYY-MM-DD`)

**Returns** `{ total_gross, total_deductions, total_net, total_hours, shift_count, verified_count, avg_commission_rate, platform_breakdown[] }`

---

### `GET /api/earnings/worker/{worker_id}/trends` 🔑
Weekly earnings and commission trends.  
Workers can only access their own data.

**Query Params**
| Param | Type | Default | Notes |
|---|---|---|---|
| `months` | int 1–12 | 3 | Lookback window |

**Returns** `{ earnings_trend[], commission_trend[], city_median_comparison[] }`

---

## 3. Anomaly Service — Port 8003

### `GET /health` 🔓
Health check.

---

### `POST /api/anomaly/detect` 🔓
Run anomaly detection on an array of earnings records (stateless, no DB write).  
No auth required — useful for testing. Requires at least 3 records.

**Body (JSON)**
```json
{
  "earnings": [
    {
      "shift_date": "2026-03-01",
      "platform": "Careem",
      "gross_earned": "2000.00",
      "platform_deductions": "300.00",
      "net_received": "1700.00",
      "hours_worked": "6.00"
    }
  ]
}
```
- Max 5 000 entries per request
- `shift_date`: must be a parseable date string
- All numeric fields: positive bounds, `hours_worked ≤ 24`

**Returns** `{ anomalies_found, anomalies[], summary }`

Each anomaly: `{ type, severity, shift_date, platform, metric, expected_range, actual_value, deviation_score, explanation }`

---

### `POST /api/anomaly/analyze-worker` 🔑✅📣
Fetch the authenticated worker's shifts from the Earnings Service, run all detections, and cache results in the DB (replaces previous results).

**Returns** `{ anomalies_cached, anomalies[] }`

---

### `GET /api/anomaly/results/{worker_id}` 🔑
Retrieve cached anomaly results for a worker.

**Query Params**
| Param | Type | Notes |
|---|---|---|
| `severity` | string | Filter: `"low"` \| `"medium"` \| `"high"` |

**Returns** `[{ id, worker_id, anomaly_type, severity, metric_name, expected_low, expected_high, actual_value, deviation_score, explanation, detected_at }]`

---

## 4. Grievance Service — Port 8004

> All grievance endpoints require `Authorization: Bearer <token>`.  
> `worker_id` is hidden in responses when `is_anonymous = true`.

### `GET /health` 🔓
Health check.

---

### `POST /api/grievances` 🔑
Submit a new grievance. Auto-tags the description.

**Body (JSON)**
```json
{
  "platform_id": "uuid",
  "category": "commission_change",
  "description": "Platform raised commission from 20% to 28% without notice.",
  "is_anonymous": true
}
```
- `category`: `"commission_change"` | `"deactivation"` | `"payment_delay"` | `"unfair_rating"` | `"safety"` | `"other"`
- `description`: min 10 characters; HTML tags stripped server-side
- `is_anonymous`: defaults to `true`

**Returns** `201` — grievance object with `grievance_tags[]`

---

### `GET /api/grievances` 🔑
Browse the community grievance board (paginated).

**Query Params**
| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int ≥ 1 | 1 | |
| `limit` | int 1–100 | 20 | |
| `platform_id` | UUID | — | filter |
| `category` | enum | — | see valid values above |
| `status` | enum | — | `open` \| `escalated` \| `resolved` |
| `tag` | string ≤ 100 | — | filter by auto-tag |

**Returns** `{ items[], total, page, limit, total_pages }`

---

### `GET /api/grievances/clusters` 📣
Cluster analysis — groups grievances by platform+category to identify systemic issues.

**Query Params**
| Param | Type | Default | Notes |
|---|---|---|---|
| `days` | int 1–365 | 30 | Lookback window |
| `min_cluster_size` | int 1–100 | 3 | Minimum complaints to form a cluster |

**Returns** `[{ platform_name, category, complaint_count, earliest, latest, escalated_count, common_tags[], sample_descriptions[] }]`

---

### `GET /api/grievances/stats` 📣
High-level grievance statistics for the advocate dashboard.

**Returns** `{ total, by_status[], by_category[], by_platform[], trending_tags[] }`

---

### `GET /api/grievances/:id` 🔑
Get a single grievance by ID.

---

### `PATCH /api/grievances/:id/status` 📣
Advance a grievance through the workflow.

**Body**
```json
{ "status": "escalated", "resolution_notes": "optional note" }
```

**Valid transitions:**
- `open → escalated` or `open → resolved`
- `escalated → resolved`
- `resolved →` *(terminal, no transitions)*

**Returns** — updated grievance object

---

### `DELETE /api/grievances/:id` 🔑
Delete a grievance.  
Workers can only delete their own. Advocates can delete any.

**Returns** `204 No Content`

---

### `POST /api/grievances/:id/tags` 📣
Manually add a tag to a grievance.

**Body** `{ "tag": "commission_issue" }`

**Returns** `201` — tag object

---

### `DELETE /api/grievances/:id/tags/:tag` 📣
Remove a specific tag from a grievance.

**Returns** `204 No Content`

---

## 5. Certificate Service — Port 8006

### `GET /health` 🔓
Health check.

---

### `GET /api/certificate/preview` 🔑
Get the certificate data as JSON (for frontend rendering preview).

**Query Params**
| Param | Type | Required | Notes |
|---|---|---|---|
| `date_from` | date | ✓ | `YYYY-MM-DD` |
| `date_to` | date | ✓ | `YYYY-MM-DD` |

**Returns** — certificate context object `{ cert_id, worker_name, date_from, date_to, total_gross, total_deductions, total_net, total_hours, hourly_rate, shift_count, verified_count, platform_breakdown[] }`

---

### `GET /api/certificate/generate` 🔑
Generate and return a rendered HTML certificate.

**Query Params** — same as `/preview`

**Returns** `200 text/html` — rendered Jinja2 certificate page

---

## Error Response Format

All Python services return:

```json
{
  "error": "validation_error",
  "message": "Request validation failed",
  "details": [
    { "field": "body → gross_earned", "message": "Input should be greater than 0" }
  ]
}
```

The Grievance service (Node.js) returns:
```json
{ "detail": "error message here" }
```

---

## Quick Auth Summary Table

| Endpoint | 🔓 Public | 🔑 Any Auth | 👷 Worker | ✅ Verifier | 📣 Advocate |
|---|:---:|:---:|:---:|:---:|:---:|
| `POST /api/auth/register` | ✓ | | | | |
| `POST /api/auth/login` | ✓ | | | | |
| `POST /api/auth/refresh` | ✓ | | | | |
| `GET /api/auth/city-zones` | ✓ | | | | |
| `GET /api/auth/me` | | ✓ | | | |
| `GET /api/auth/validate` | | ✓ | | | |
| `POST /api/earnings/shifts` | | | ✓ | | |
| `POST /api/earnings/shifts/import` | | | ✓ | | |
| `POST /api/earnings/shifts/{id}/screenshot` | | | ✓ | | |
| `GET /api/earnings/shifts` | | ✓ | | | |
| `GET /api/earnings/shifts/{id}` | | ✓ | | | |
| `GET /api/earnings/shifts/{id}/screenshot` | | ✓ | | | |
| `GET /api/earnings/imports` | | ✓ | | | |
| `GET /api/earnings/platforms` | | ✓ | | | |
| `GET /api/earnings/worker/{id}/shifts-raw` | | ✓ | | | |
| `GET /api/earnings/worker/{id}/summary` | | ✓ | | | |
| `GET /api/earnings/worker/{id}/trends` | | ✓ | | | |
| `GET /api/earnings/verification-queue` | | | | ✓ | |
| `POST /api/earnings/shifts/{id}/verify` | | | | ✓ | |
| `POST /api/anomaly/detect` | ✓ | | | | |
| `POST /api/anomaly/analyze-worker` | | ✓ | | | |
| `GET /api/anomaly/results/{worker_id}` | | ✓ | | | |
| `POST /api/grievances` | | ✓ | | | |
| `GET /api/grievances` | | ✓ | | | |
| `GET /api/grievances/:id` | | ✓ | | | |
| `DELETE /api/grievances/:id` | | ✓* | | | |
| `GET /api/grievances/clusters` | | | | | ✓ |
| `GET /api/grievances/stats` | | | | | ✓ |
| `PATCH /api/grievances/:id/status` | | | | | ✓ |
| `POST /api/grievances/:id/tags` | | | | | ✓ |
| `DELETE /api/grievances/:id/tags/:tag` | | | | | ✓ |
| `GET /api/certificate/preview` | | ✓ | | | |
| `GET /api/certificate/generate` | | ✓ | | | |

> \* Workers can only delete **their own** grievances. Advocates can delete any.
