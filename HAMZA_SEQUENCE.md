# Hamza's Build Sequence — FairGig

**Your services:** Anomaly (8003) → Grievance (8004) → Analytics (8005)  
**Your role:** Intelligence & community layer — statistical engine, complaint board, advocate dashboard

---

## What's Already Done (By Shaheer)

- PostgreSQL DB is live, all 10 tables created via Alembic migrations
- SQLAlchemy models defined in `services/auth/app/models.py` — you COPY these, don't rewrite
- Auth Service running on `:8001` with `/api/auth/validate` endpoint
- Auth validate returns: `{ user_id: UUID, role: str, city_zone_id: UUID | null }`
- Seed data is in — 200+ workers, ~8000 shifts, 60+ grievances, anomaly results
- Views created: `zone_earnings_summary` (regular) + `monthly_worker_totals` (materialized)

---

## Key Patterns To Follow (From Auth Service Code)

### config.py pattern (copy this exactly, add your vars)
```python
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file="../../.env", env_file_encoding="utf-8", extra="ignore")
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/fairgig"
    auth_service_url: str = "http://localhost:8001"
    earnings_service_url: str = "http://localhost:8002"   # anomaly needs this

@lru_cache
def get_settings() -> Settings: return Settings()
```

### database.py pattern (copy get_db from auth, use get_db_with_rls for shift_logs)
The auth service already has both `get_db` and `get_db_with_rls` — copy `database.py` as-is.

### dependencies.py pattern (HTTP call to Auth Service)
```python
import httpx
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import get_settings

bearer = HTTPBearer()
settings = get_settings()

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.auth_service_url}/api/auth/validate",
            headers={"Authorization": f"Bearer {creds.credentials}"}
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return resp.json()  # {"user_id": "...", "role": "...", "city_zone_id": "..."}

def require_role(*roles: str):
    async def _check(user=Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail=f"Requires role: {roles}")
        return user
    return _check
```

---

## PHASE H1 — Anomaly Service: Detection Engine (START HERE — No DB needed)

> **Why first:** The `/detect` endpoint is 100% stateless. Judges test this directly. Build and test it NOW before anything else.

### H1.1 — Create folder structure
```
services/anomaly/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py
│   ├── database.py          ← copy from auth
│   ├── models.py            ← copy from auth (need AnomalyResult)
│   ├── dependencies.py      ← HTTP call pattern above
│   ├── routes/
│   │   ├── __init__.py
│   │   └── detect.py
│   ├── engine/
│   │   ├── __init__.py
│   │   ├── detector.py
│   │   ├── zscore.py
│   │   ├── iqr.py
│   │   ├── rolling.py
│   │   ├── mom.py
│   │   ├── sanity.py
│   │   └── explainer.py
│   └── schemas/
│       ├── __init__.py
│       ├── detect.py
│       └── results.py
├── requirements.txt
└── README.md
```

### H1.2 — main.py
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.detect import router as detect_router

app = FastAPI(title="FairGig Anomaly Service", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
app.include_router(detect_router)

@app.get("/health")
async def health(): return {"status": "ok", "service": "anomaly"}
```

### H1.3 — schemas/detect.py
```python
from pydantic import BaseModel
from typing import Optional, List
from decimal import Decimal

class EarningItem(BaseModel):
    shift_date: str              # "2026-01-15"
    platform: str
    gross_earned: Decimal
    platform_deductions: Decimal
    net_received: Decimal
    hours_worked: Decimal

class DetectRequest(BaseModel):
    earnings: List[EarningItem]

class ExpectedRange(BaseModel):
    low: float
    high: float

class AnomalyItem(BaseModel):
    type: str                    # unusual_deduction | income_drop | rate_spike | hours_mismatch | mom_drop
    severity: str                # low | medium | high
    shift_date: str
    platform: str
    metric: str
    expected_range: ExpectedRange
    actual_value: float
    deviation_score: float
    explanation: str

class DetectResponse(BaseModel):
    anomalies_found: int
    anomalies: List[AnomalyItem]
    summary: str
```

### H1.4 — engine/zscore.py
Copy EXACTLY from BE_ARCH.md → `detect_unusual_deductions()`.
Key logic: per-platform Z-score on commission rate, threshold `|Z| > 2.0`.

### H1.5 — engine/iqr.py
Copy EXACTLY from BE_ARCH.md → `detect_rate_outliers()`.
Key logic: IQR on effective hourly rate, flag if outside Q1-1.5×IQR or Q3+1.5×IQR.

### H1.6 — engine/rolling.py
Copy EXACTLY from BE_ARCH.md → `detect_income_drops()`.
Key logic: 7-shift rolling average, flag if current < 70% of average.

### H1.7 — engine/mom.py
Copy EXACTLY from BE_ARCH.md → `detect_mom_drops()`.
Key logic: monthly total, flag if month N < 80% of month N-1.

### H1.8 — engine/sanity.py
Copy EXACTLY from BE_ARCH.md → `detect_hours_issues()`.
Key logic: flag hours > 16, flag hourly_rate < PKR 100.

### H1.9 — engine/explainer.py
Copy EXACTLY from BE_ARCH.md → `TEMPLATES` dict + `generate_explanation()`.

### H1.10 — engine/detector.py
Copy EXACTLY from BE_ARCH.md → `run_all_detections()` + `_severity_rank()`.
This is the orchestrator: calls all 5 methods → deduplicates → generates explanations → sorts.

### H1.11 — routes/detect.py (THE JUDGE-TESTED ENDPOINT)
```python
from fastapi import APIRouter
from app.schemas.detect import DetectRequest, DetectResponse
from app.engine.detector import run_all_detections

router = APIRouter(prefix="/api/anomaly", tags=["anomaly"])

@router.post("/detect", response_model=DetectResponse)
async def detect(body: DetectRequest):
    earnings = [e.model_dump() for e in body.earnings]
    # Convert Decimal to float for engine
    for e in earnings:
        for k in ["gross_earned", "platform_deductions", "net_received", "hours_worked"]:
            e[k] = float(e[k])
    
    if len(earnings) == 0:
        return DetectResponse(anomalies_found=0, anomalies=[], summary="No data provided")
    if len(earnings) < 3:
        return DetectResponse(anomalies_found=0, anomalies=[], summary="Insufficient data — need at least 3 shifts")
    
    anomalies = run_all_detections(earnings)
    return DetectResponse(
        anomalies_found=len(anomalies),
        anomalies=anomalies,
        summary=f"Detected {len(anomalies)} anomalies" if anomalies else "No anomalies detected"
    )
```

### H1.12 — requirements.txt
```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlalchemy[asyncio]==2.0.36
asyncpg==0.30.0
alembic==1.14.1
pydantic==2.10.4
pydantic-settings==2.7.1
httpx==0.28.1
python-dotenv==1.0.1
numpy==2.2.1
```

### ✅ CHECKPOINT H1 — Test with curl before moving on
```bash
# Start service: uvicorn app.main:app --port 8003 --reload
# From services/anomaly/

# Test 1: Normal anomaly detection (entry 4 has 30% commission vs ~22%)
curl -X POST http://localhost:8003/api/anomaly/detect \
  -H "Content-Type: application/json" \
  -d '{
    "earnings": [
      {"shift_date":"2026-01-15","platform":"Careem","gross_earned":2500,"platform_deductions":550,"net_received":1950,"hours_worked":6},
      {"shift_date":"2026-01-16","platform":"Careem","gross_earned":2300,"platform_deductions":506,"net_received":1794,"hours_worked":5.5},
      {"shift_date":"2026-01-17","platform":"Careem","gross_earned":2400,"platform_deductions":528,"net_received":1872,"hours_worked":6},
      {"shift_date":"2026-01-18","platform":"Careem","gross_earned":2600,"platform_deductions":780,"net_received":1820,"hours_worked":7},
      {"shift_date":"2026-01-19","platform":"Careem","gross_earned":2200,"platform_deductions":484,"net_received":1716,"hours_worked":5}
    ]
  }'
# Expected: unusual_deduction on 2026-01-18 with high severity

# Test 2: Empty → anomalies_found: 0
curl -X POST http://localhost:8003/api/anomaly/detect -H "Content-Type: application/json" -d '{"earnings":[]}'

# Test 3: 2 entries → Insufficient data
curl -X POST http://localhost:8003/api/anomaly/detect -H "Content-Type: application/json" \
  -d '{"earnings":[{"shift_date":"2026-01-01","platform":"Careem","gross_earned":2000,"platform_deductions":400,"net_received":1600,"hours_worked":5},{"shift_date":"2026-01-02","platform":"Careem","gross_earned":2000,"platform_deductions":400,"net_received":1600,"hours_worked":5}]}'
```

---

## PHASE H2 — Anomaly Service: DB Integration (Needs DB ready)

> Wait for Shaheer to confirm DB + Earnings Service is up before doing H2.2 and H2.3.

### H2.1 — config.py + database.py + dependencies.py
- config.py: copy from auth, add `earnings_service_url`
- database.py: copy from auth exactly
- dependencies.py: use the HTTP call pattern shown above

### H2.2 — routes/detect.py: Add `analyze-worker` endpoint
```python
import httpx
from fastapi import Depends, HTTPException
from app.dependencies import get_current_user, require_role
from app.database import get_db
from app.models import AnomalyResult
from sqlalchemy.ext.asyncio import AsyncSession

@router.post("/analyze-worker")
async def analyze_worker(
    db: AsyncSession = Depends(get_db),
    user=Depends(require_role("worker", "advocate", "verifier")),
):
    worker_id = user["user_id"]
    settings = get_settings()
    
    # Fetch earnings from Earnings Service
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.earnings_service_url}/api/earnings/worker/{worker_id}/shifts-raw",
            headers={"Authorization": f"Bearer {token}"}  # pass token through
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not fetch earnings data")
    
    earnings = resp.json()
    anomalies = run_all_detections(earnings)
    
    # Clear old results and cache new ones
    await db.execute(delete(AnomalyResult).where(AnomalyResult.worker_id == worker_id))
    for a in anomalies:
        db.add(AnomalyResult(
            worker_id=worker_id,
            anomaly_type=a["type"],
            severity=a["severity"],
            metric_name=a["metric"],
            expected_low=a["expected_range"]["low"],
            expected_high=a["expected_range"]["high"],
            actual_value=a["actual_value"],
            deviation_score=a["deviation_score"],
            explanation=a["explanation"],
        ))
    await db.commit()
    return {"anomalies_cached": len(anomalies), "anomalies": anomalies}
```

### H2.3 — routes/detect.py: Add `results/:worker_id` endpoint
```python
@router.get("/results/{worker_id}")
async def get_results(
    worker_id: str,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    stmt = select(AnomalyResult).where(AnomalyResult.worker_id == worker_id)
    if severity:
        stmt = stmt.where(AnomalyResult.severity == severity)
    stmt = stmt.order_by(AnomalyResult.detected_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()
```

---

## PHASE H3 — Grievance Service: Setup + CRUD (Node.js — needs DB)

> Context switch: this is JavaScript/Express. Different mental model from Python.

### H3.1 — Project init
```bash
cd services/grievance
npm init -y
npm install express @prisma/client prisma axios joi cors dotenv
```

### H3.2 — Prisma DB pull
```bash
npx prisma init
# Edit prisma/.env — set DATABASE_URL=postgresql://postgres:password@localhost:5432/fairgig
npx prisma db pull    # Reads existing tables → generates schema.prisma
npx prisma generate   # Creates typed Prisma client
```

### H3.3 — src/config.js
```javascript
require('dotenv').config({ path: '../../.env' });
module.exports = {
    PORT: process.env.GRIEVANCE_PORT || 8004,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:8001',
};
```

### H3.4 — src/index.js (Express app entry)
```javascript
const express = require('express');
const cors = require('cors');
const { PORT } = require('./config');
const grievanceRoutes = require('./routes/grievances');
const tagRoutes = require('./routes/tags');
const errorHandler = require('./middleware/errorHandler');

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'grievance' }));
app.use('/api/grievances', grievanceRoutes);
app.use('/api/grievances', tagRoutes);
app.use(errorHandler);

app.listen(PORT, () => console.log(`Grievance service on :${PORT}`));
```

### H3.5 — src/middleware/auth.js
```javascript
const axios = require('axios');
const { AUTH_SERVICE_URL } = require('../config');

module.exports = async function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ detail: 'Authorization header missing' });
    }
    try {
        const { data } = await axios.get(`${AUTH_SERVICE_URL}/api/auth/validate`, {
            headers: { Authorization: header }
        });
        req.user = data;  // { user_id, role, city_zone_id }
        next();
    } catch {
        return res.status(401).json({ detail: 'Invalid or expired token' });
    }
};

module.exports.requireRole = function(...roles) {
    return (req, res, next) => {
        if (!roles.includes(req.user?.role)) {
            return res.status(403).json({ detail: `Requires role: ${roles.join(' or ')}` });
        }
        next();
    };
};
```

### H3.6 — src/middleware/errorHandler.js
```javascript
module.exports = function errorHandler(err, req, res, next) {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ detail: err.message || 'Internal server error' });
};
```

### H3.7 — src/services/autoTagger.js
Copy EXACTLY from BE_ARCH.md → `TAG_KEYWORDS` object + `autoTag()` function.

### H3.8 — src/validators/grievanceValidator.js
```javascript
const Joi = require('joi');

const createSchema = Joi.object({
    platform_id: Joi.string().uuid().required(),
    category: Joi.string().valid(
        'commission_change','deactivation','payment_delay',
        'unfair_rating','safety','other'
    ).required(),
    description: Joi.string().min(10).required(),
    is_anonymous: Joi.boolean().default(true),
});

const statusSchema = Joi.object({
    status: Joi.string().valid('open','escalated','resolved').required(),
    resolution_notes: Joi.string().optional(),
});

module.exports = { createSchema, statusSchema };
```

### H3.9 — src/routes/grievances.js: POST /api/grievances
```javascript
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');
const { autoTag } = require('../services/autoTagger');
const { createSchema, statusSchema } = require('../validators/grievanceValidator');

const router = express.Router();
const prisma = new PrismaClient();

// POST — create complaint
router.post('/', authenticate, async (req, res, next) => {
    try {
        const { error, value } = createSchema.validate(req.body);
        if (error) return res.status(400).json({ detail: error.details[0].message });
        
        // Sanitize HTML from description
        const cleanDesc = value.description.replace(/<[^>]*>/g, '').trim();
        const tags = autoTag(cleanDesc);
        
        const grievance = await prisma.grievances.create({
            data: {
                worker_id: req.user.user_id,
                platform_id: value.platform_id,
                category: value.category,
                description: cleanDesc,
                is_anonymous: value.is_anonymous ?? true,
                grievance_tags: {
                    create: tags.map(tag => ({ tag }))
                }
            },
            include: { grievance_tags: true }
        });
        
        // Mask identity if anonymous
        const out = { ...grievance };
        if (out.is_anonymous) out.worker_id = null;
        res.status(201).json(out);
    } catch (err) { next(err); }
});
```

### H3.10 — src/routes/grievances.js: GET /api/grievances (paginated + search)
```javascript
// GET — list with filters
router.get('/', authenticate, async (req, res, next) => {
    try {
        const { page=1, limit=20, platform_id, category, status, tag, q } = req.query;
        const skip = (parseInt(page)-1) * parseInt(limit);
        
        const where = {};
        if (platform_id) where.platform_id = platform_id;
        if (category) where.category = category;
        if (status) where.status = status;
        if (tag) where.grievance_tags = { some: { tag } };
        
        let grievances, total;
        
        if (q) {
            // Full-text search via raw SQL
            const results = await prisma.$queryRaw`
                SELECT g.*, array_agg(gt.tag) FILTER (WHERE gt.tag IS NOT NULL) as tags
                FROM grievances g
                LEFT JOIN grievance_tags gt ON g.id = gt.grievance_id
                WHERE to_tsvector('english', g.description) @@ plainto_tsquery('english', ${q})
                GROUP BY g.id
                ORDER BY g.created_at DESC
                LIMIT ${parseInt(limit)} OFFSET ${skip}
            `;
            grievances = results;
            total = results.length; // simplified for FTS
        } else {
            [grievances, total] = await Promise.all([
                prisma.grievances.findMany({
                    where, skip, take: parseInt(limit),
                    orderBy: { created_at: 'desc' },
                    include: { grievance_tags: true }
                }),
                prisma.grievances.count({ where })
            ]);
        }
        
        // Mask anonymous
        const out = grievances.map(g => ({
            ...g, worker_id: g.is_anonymous ? null : g.worker_id
        }));
        
        res.json({
            items: out, total, page: parseInt(page),
            limit: parseInt(limit), total_pages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) { next(err); }
});
```

### H3.11 — GET /api/grievances/:id, PATCH /:id/status, DELETE /:id
```javascript
// GET single
router.get('/:id', authenticate, async (req, res, next) => {
    try {
        const g = await prisma.grievances.findUnique({
            where: { id: req.params.id },
            include: { grievance_tags: true }
        });
        if (!g) return res.status(404).json({ detail: 'Grievance not found' });
        const out = { ...g, worker_id: g.is_anonymous ? null : g.worker_id };
        res.json(out);
    } catch (err) { next(err); }
});

// PATCH status (advocate only)
const VALID_STATUS_TRANSITIONS = {
    open: ['escalated', 'resolved'],
    escalated: ['resolved'],
    resolved: []
};

router.patch('/:id/status', authenticate, requireRole('advocate'), async (req, res, next) => {
    try {
        const { error, value } = statusSchema.validate(req.body);
        if (error) return res.status(400).json({ detail: error.details[0].message });
        
        const g = await prisma.grievances.findUnique({ where: { id: req.params.id } });
        if (!g) return res.status(404).json({ detail: 'Grievance not found' });
        
        const allowed = VALID_STATUS_TRANSITIONS[g.status] || [];
        if (!allowed.includes(value.status)) {
            return res.status(409).json({ detail: `Cannot transition from '${g.status}' to '${value.status}'` });
        }
        
        const updated = await prisma.grievances.update({
            where: { id: req.params.id },
            data: { status: value.status, resolution_notes: value.resolution_notes, updated_at: new Date() }
        });
        res.json(updated);
    } catch (err) { next(err); }
});

// DELETE
router.delete('/:id', authenticate, async (req, res, next) => {
    try {
        const g = await prisma.grievances.findUnique({ where: { id: req.params.id } });
        if (!g) return res.status(404).json({ detail: 'Grievance not found' });
        // Worker can delete own; advocate can delete any
        if (req.user.role !== 'advocate' && g.worker_id !== req.user.user_id) {
            return res.status(403).json({ detail: 'Cannot delete another worker\'s grievance' });
        }
        await prisma.grievances.delete({ where: { id: req.params.id } });
        res.status(204).send();
    } catch (err) { next(err); }
});
```

---

## PHASE H4 — Grievance Service: Clusters + Stats (Advocate Features)

### H4.1 — src/routes/grievances.js: GET /api/grievances/clusters
> **IMPORTANT:** Register `/clusters` and `/stats` routes BEFORE `/:id` routes or Express will match them as IDs.

```javascript
// Register order in index.js matters: /clusters BEFORE /:id

router.get('/clusters', authenticate, requireRole('advocate'), async (req, res, next) => {
    try {
        const days = parseInt(req.query.days) || 30;
        const minClusterSize = parseInt(req.query.min_cluster_size) || 3;
        
        const clusters = await prisma.$queryRaw`
            SELECT
                p.name AS platform_name,
                g.category,
                COUNT(*)::int AS complaint_count,
                MIN(g.created_at) AS earliest,
                MAX(g.created_at) AS latest,
                COUNT(*) FILTER (WHERE g.status = 'escalated')::int AS escalated_count,
                ARRAY_AGG(DISTINCT gt.tag) FILTER (WHERE gt.tag IS NOT NULL) AS common_tags,
                ARRAY(
                    SELECT LEFT(sub.description, 100)
                    FROM grievances sub
                    WHERE sub.platform_id = g.platform_id AND sub.category = g.category
                      AND sub.created_at >= NOW() - (${days} || ' days')::interval
                    ORDER BY sub.created_at DESC LIMIT 3
                ) AS sample_descriptions
            FROM grievances g
            JOIN platforms p ON g.platform_id = p.id
            LEFT JOIN grievance_tags gt ON g.id = gt.grievance_id
            WHERE g.created_at >= NOW() - (${days} || ' days')::interval
            GROUP BY p.name, g.category, g.platform_id
            HAVING COUNT(*) >= ${minClusterSize}
            ORDER BY COUNT(*) DESC
        `;
        res.json(clusters);
    } catch (err) { next(err); }
});
```

### H4.2 — GET /api/grievances/stats
```javascript
router.get('/stats', authenticate, requireRole('advocate'), async (req, res, next) => {
    try {
        const [total, byStatus, byCategory, byPlatform, trendingTags] = await Promise.all([
            prisma.grievances.count(),
            prisma.grievances.groupBy({ by: ['status'], _count: { id: true } }),
            prisma.grievances.groupBy({ by: ['category'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
            prisma.$queryRaw`
                SELECT p.name as platform, COUNT(*)::int as count
                FROM grievances g JOIN platforms p ON g.platform_id = p.id
                GROUP BY p.name ORDER BY count DESC
            `,
            prisma.$queryRaw`
                SELECT tag, COUNT(*)::int as count FROM grievance_tags
                GROUP BY tag ORDER BY count DESC LIMIT 10
            `
        ]);
        
        res.json({ total, by_status: byStatus, by_category: byCategory,
                   by_platform: byPlatform, trending_tags: trendingTags });
    } catch (err) { next(err); }
});
```

### H4.3 — src/routes/tags.js: Tag management
```javascript
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const authenticate = require('../middleware/auth');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// POST /:id/tags (advocate only)
router.post('/:id/tags', authenticate, requireRole('advocate'), async (req, res, next) => {
    try {
        const { tag } = req.body;
        if (!tag) return res.status(400).json({ detail: 'tag is required' });
        
        const result = await prisma.grievance_tags.create({
            data: { grievance_id: req.params.id, tag }
        });
        res.status(201).json(result);
    } catch (err) {
        if (err.code === 'P2002') return res.status(409).json({ detail: 'Tag already exists' });
        next(err);
    }
});

// DELETE /:id/tags/:tag (advocate only)
router.delete('/:id/tags/:tag', authenticate, requireRole('advocate'), async (req, res, next) => {
    try {
        await prisma.grievance_tags.deleteMany({
            where: { grievance_id: req.params.id, tag: req.params.tag }
        });
        res.status(204).send();
    } catch (err) { next(err); }
});

module.exports = router;
```

### ✅ CHECKPOINT H4 — Test clusters with seeded data
```bash
# Start: node src/index.js (from services/grievance/)
# Get a token first (POST /api/auth/login with advocate credentials)

curl -H "Authorization: Bearer <token>" \
  "http://localhost:8004/api/grievances/clusters?days=60&min_cluster_size=3"
# Expected: Careem + commission_change cluster with count >= 10

curl -H "Authorization: Bearer <token>" \
  "http://localhost:8004/api/grievances/stats"
# Expected: total counts, top category, trending tags
```

---

## PHASE H5 — Analytics Service (Needs seeded DB)

> This is Python/FastAPI again. All queries read from views — no raw shift_logs.

### H5.1 — Folder structure + scaffolding
```
services/analytics/
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── config.py           ← copy from auth (no extra vars needed)
│   ├── database.py         ← copy from auth
│   ├── dependencies.py     ← HTTP call pattern
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── commission.py
│   │   ├── income.py
│   │   ├── vulnerability.py
│   │   ├── dashboard.py
│   │   └── comparison.py
│   ├── queries/
│   │   ├── __init__.py
│   │   ├── commission_trends.py
│   │   ├── income_distribution.py
│   │   ├── vulnerability_flags.py
│   │   ├── dashboard_kpis.py
│   │   └── platform_comparison.py
│   └── schemas/
│       ├── __init__.py
│       └── analytics.py
├── requirements.txt
└── README.md
```

### H5.2 — routes/commission.py: GET /api/analytics/commission-trends
```python
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

@router.get("/commission-trends")
async def commission_trends(
    months: int = Query(3, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role("advocate")),
):
    query = text("""
        SELECT
            platform_name,
            week,
            ROUND(avg_commission_rate::numeric, 2) AS avg_commission_rate,
            worker_count,
            total_shifts
        FROM zone_earnings_summary
        WHERE week >= NOW() - INTERVAL '1 month' * :months
        GROUP BY platform_name, week, avg_commission_rate, worker_count, total_shifts
        ORDER BY week, platform_name
    """)
    result = await db.execute(query, {"months": months})
    return [dict(row._mapping) for row in result.fetchall()]
```

### H5.3 — routes/income.py: GET /api/analytics/income-distribution
```python
@router.get("/income-distribution")
async def income_distribution(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role("advocate")),
):
    query = text("""
        SELECT
            zone_name,
            platform_name,
            ROUND(p25_net::numeric, 2) AS p25_net,
            ROUND(median_net::numeric, 2) AS p50_net,
            ROUND(p75_net::numeric, 2) AS p75_net,
            ROUND(avg_net::numeric, 2) AS avg_net,
            worker_count
        FROM zone_earnings_summary
        WHERE week = (SELECT MAX(week) FROM zone_earnings_summary)
        ORDER BY zone_name, platform_name
    """)
    result = await db.execute(query)
    return [dict(row._mapping) for row in result.fetchall()]
```

### H5.4 — queries/vulnerability_flags.py + routes/vulnerability.py
Copy the `VULNERABILITY_QUERY` EXACTLY from BE_ARCH.md.
```python
# routes/vulnerability.py
from app.queries.vulnerability_flags import VULNERABILITY_QUERY

@router.get("/vulnerability-flags")
async def vulnerability_flags(
    threshold: float = Query(0.20, ge=0.0, le=1.0),
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role("advocate")),
):
    result = await db.execute(text(VULNERABILITY_QUERY), {"threshold": threshold})
    return [dict(row._mapping) for row in result.fetchall()]
```

### H5.5 — queries/platform_comparison.py + routes/comparison.py
Copy `PLATFORM_COMPARISON_QUERY` from BE_ARCH.md.
**Fix the SQL:** Replace `:months` inside the INTERVAL string with a proper parameterized approach:
```python
# The INTERVAL ':months months' pattern doesn't work — use INTERVAL + parameter differently
query = text("""
    ...
    WHERE sl.shift_date >= NOW() - MAKE_INTERVAL(months => :months)
    ...
    WHERE created_at >= NOW() - MAKE_INTERVAL(months => :months)
    ...
""")
```

### H5.6 — routes/dashboard.py: GET /api/analytics/dashboard-summary
Copy EXACTLY from BE_ARCH.md → `asyncio.gather` pattern.
```python
import asyncio
from sqlalchemy import text, func, select
from app.models import User, ShiftLog, Grievance, Platform

@router.get("/dashboard-summary")
async def dashboard_summary(
    db: AsyncSession = Depends(get_db),
    _user=Depends(require_role("advocate")),
):
    async def _count_active_workers(db):
        r = await db.execute(text("SELECT COUNT(DISTINCT worker_id) FROM shift_logs WHERE shift_date >= NOW() - INTERVAL '30 days'"))
        return r.scalar()
    
    async def _count_shifts(db):
        r = await db.execute(text("SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE verification_status='verified') as verified, COUNT(*) FILTER (WHERE verification_status='disputed') as disputed FROM shift_logs"))
        row = r.fetchone()
        return {"total": row[0], "verified": row[1], "disputed": row[2]}
    
    async def _avg_commission(db):
        r = await db.execute(text("SELECT AVG(platform_deductions / NULLIF(gross_earned,0)) * 100 FROM shift_logs"))
        return float(r.scalar() or 0)
    
    async def _count_vulnerable(db):
        r = await db.execute(text("""
            WITH m AS (SELECT worker_id, month, total_net,
                LAG(total_net) OVER (PARTITION BY worker_id ORDER BY month) AS prev
                FROM monthly_worker_totals)
            SELECT COUNT(*) FROM m
            WHERE prev IS NOT NULL AND prev > 0 AND (prev - total_net)/prev > 0.20
              AND month = (SELECT MAX(month) FROM monthly_worker_totals)
        """))
        return int(r.scalar() or 0)
    
    async def _count_open_grievances(db):
        r = await db.execute(text("SELECT COUNT(*) FROM grievances WHERE status IN ('open','escalated')"))
        return int(r.scalar() or 0)
    
    async def _top_category(db):
        r = await db.execute(text("SELECT category FROM grievances GROUP BY category ORDER BY COUNT(*) DESC LIMIT 1"))
        row = r.fetchone()
        return row[0] if row else None
    
    async def _count_platforms(db):
        r = await db.execute(text("SELECT COUNT(*) FROM platforms"))
        return int(r.scalar())
    
    (active_workers, shift_counts, avg_commission, vulnerable_count,
     open_grievances, top_category, platform_count) = await asyncio.gather(
        _count_active_workers(db), _count_shifts(db), _avg_commission(db),
        _count_vulnerable(db), _count_open_grievances(db), _top_category(db), _count_platforms(db)
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

### ✅ CHECKPOINT H5 — Test analytics with seeded data
```bash
# Start: uvicorn app.main:app --port 8005 --reload (from services/analytics/)

# Commission trends — should show Careem spike in week 8
curl -H "Authorization: Bearer <advocate_token>" http://localhost:8005/api/analytics/commission-trends

# Income distribution — DHA should earn more than Johar Town
curl -H "Authorization: Bearer <advocate_token>" http://localhost:8005/api/analytics/income-distribution

# Vulnerability flags — should show 5 workers with >20% MoM drop
curl -H "Authorization: Bearer <advocate_token>" http://localhost:8005/api/analytics/vulnerability-flags

# Dashboard — parallel KPIs
curl -H "Authorization: Bearer <advocate_token>" http://localhost:8005/api/analytics/dashboard-summary
```

---

## PHASE H6 — Integration Testing

| Task | What to test |
|------|-------------|
| I2 | `POST /api/anomaly/analyze-worker` → fetches from Earnings Service, caches in DB |
| I3 | `GET /api/analytics/dashboard-summary` → reads from seeded data, returns non-zero counts |
| I6 | Send Careem week-8 spike data to `/detect` → `unusual_deduction` with high severity |
| I7 | `GET /api/grievances/clusters?days=60` → Careem + commission_change cluster appears |
| I8 | `GET /api/analytics/vulnerability-flags` → 5 workers returned |
| I4 | Send request WITHOUT Bearer token to any endpoint → 401 |
| I4 | Send request with worker token to advocate endpoint → 403 |

---

## Start Commands (Final)

```bash
# Anomaly Service
cd services/anomaly
pip install -r requirements.txt
uvicorn app.main:app --port 8003 --reload

# Grievance Service
cd services/grievance
npm install
npx prisma db pull && npx prisma generate
node src/index.js

# Analytics Service
cd services/analytics
pip install -r requirements.txt
uvicorn app.main:app --port 8005 --reload
```

---

## Files To Copy From Auth Service (Don't Rewrite)

| File | Copy to | Notes |
|------|---------|-------|
| `auth/app/models.py` | `anomaly/app/models.py`, `analytics/app/models.py` | All models needed |
| `auth/app/database.py` | Same in each service | Exact copy |
| `auth/app/config.py` | Same in each service | Add `earnings_service_url` in anomaly |
| `auth/requirements.txt` | Base for anomaly + analytics | Add `httpx`, `numpy` for anomaly |

---

## Build Order Summary

```
[NOW]   H1.1–H1.12  → Anomaly /detect endpoint (NO DB needed) ← START HERE
[NOW]   H1 test     → Verify with curl before moving on

[AFTER DB READY]
        H2.1–H2.3   → Anomaly DB + analyze-worker endpoint
        H3.1–H3.12  → Grievance Service full CRUD (Node.js)
        H4.1–H4.3   → Grievance clusters + stats
        H5.1–H5.6   → Analytics Service all 5 endpoints

[AFTER ALL DONE]
        H6          → Integration testing with seeded data
```
