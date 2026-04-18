# FairGig

A platform empowering Pakistan's gig workers to log, verify, and understand their earnings across platforms, while giving labour advocates tools to spot systemic unfairness at scale. Workers log shifts and upload earnings screenshots; verifiers review them; advocates monitor commission trends, income volatility, and complaint clusters — all backed by a privacy-first database design with k-anonymity and Row-Level Security.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Vite + React)  :5173          │
└───────────────────────────────┬─────────────────────────────────┘
                                │ HTTP (Axios)
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
        ▼                       ▼                        ▼
┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐
│ Auth Service │   │ Earnings Service │   │  Grievance Service  │
│  FastAPI     │   │   FastAPI        │   │  Node.js + Express  │
│  :8001       │   │   :8002          │   │  :8004              │
└──────┬───────┘   └────────┬─────────┘   └──────────┬──────────┘
       │  JWT validate      │                        │
       │◄───────────────────┤                        │
       │                    │                        │
       │           ┌────────┴────────┐               │
       │           │                 │               │
       ▼           ▼                 ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│              PostgreSQL 16 — Shared Database                    │
│   10 tables  |  2 views  |  Row-Level Security                  │
└─────────────────────────────────────────────────────────────────┘
       ▲           ▲                 ▲
       │           │                 │
┌──────┴──┐  ┌─────┴──────┐  ┌──────┴──────────┐
│ Anomaly │  │ Analytics  │  │  Certificate    │
│ FastAPI │  │ FastAPI    │  │  FastAPI        │
│ :8003   │  │ :8005      │  │  :8006          │
└─────────┘  └────────────┘  └─────────────────┘

File storage: Cloudinary (screenshots + CSV imports)
```

## Prerequisites

- Python 3.11+
- Node.js 20+
- PostgreSQL 16
- Cloudinary account (free tier is sufficient)

## Quick Start

```bash
# 1. Clone and enter the repo
git clone <repo-url>
cd fairgig

# 2. Copy environment variables
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT_SECRET, and Cloudinary credentials

# 3. Create the database
psql -U postgres -c "CREATE DATABASE fairgig;"

# 4. Set up and start the Auth Service (also runs migrations)
cd services/auth
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --port 8001 --reload

# 5. Seed the database with realistic demo data
cd ../../seed
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
python seed.py

# 6. Verify: connect to PostgreSQL and run:
#    SELECT * FROM zone_earnings_summary LIMIT 5;
```

## Services

| Service | Language | Port | Status |
|---------|----------|------|--------|
| Auth | FastAPI | 8001 | ✅ Phase 1 |
| Earnings | FastAPI | 8002 | 🔜 Phase 2 |
| Anomaly | FastAPI | 8003 | 🔜 Phase 2 |
| Grievance | Node.js/Express | 8004 | 🔜 Phase 2 |
| Analytics | FastAPI | 8005 | 🔜 Phase 2 |
| Certificate | FastAPI | 8006 | 🔜 Phase 2 |

## Documentation

- [PRD.md](PRD.md) — Full product requirements and tech stack decisions
- [DB_PLAN.md](DB_PLAN.md) — Complete database schema, indexes, views, and RLS policies
- [services/auth/README.md](services/auth/README.md) — Auth service setup and API reference

## Key Design Decisions

- **Single shared PostgreSQL database** — all services connect to the same DB; Alembic migrations run from the Auth Service as single source of truth
- **DECIMAL(12,2) for all money fields** — exact arithmetic, never float
- **k-anonymity via views** — `zone_earnings_summary` enforces `HAVING COUNT(DISTINCT worker_id) >= 5`
- **Row-Level Security** — workers can only read their own `shift_logs` rows at the database layer
- **Prisma introspection** — the Node.js Grievance Service runs `prisma db pull` to auto-generate its schema from existing tables; no duplicate schema definitions
