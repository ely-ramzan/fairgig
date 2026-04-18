# FairGig — Auth Service

JWT-based authentication and user management. This service is the **source of truth for the database schema** — all SQLAlchemy models live here and Alembic migrations run from this service.

## What this service does

- Issues and validates JWT access tokens (15 min) and refresh tokens (7 days)
- Manages user registration and login for all three roles: `worker`, `verifier`, `advocate`
- Exposes an internal `/api/auth/validate` endpoint that other services call to verify Bearer tokens without sharing the JWT secret
- Runs Alembic migrations for the entire shared PostgreSQL database

## Prerequisites

- Python 3.11+
- PostgreSQL 16
- The root `.env` file populated (copy from `.env.example`)

## Setup

```bash
# From the services/auth directory:

# 1. Create and activate a virtual environment
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # macOS/Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Create the PostgreSQL database
psql -U postgres -c "CREATE DATABASE fairgig;"

# 4. Run all migrations (creates 10 tables, 2 views, RLS policies)
alembic upgrade head

# 5. Start the server
uvicorn app.main:app --port 8001 --reload
```

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/register` | None | Create new user, returns JWT pair |
| `POST` | `/api/auth/login` | None | Login, returns JWT pair |
| `POST` | `/api/auth/refresh` | None | Exchange refresh token for new access token |
| `GET` | `/api/auth/me` | Bearer | Get current user profile with city zone |
| `GET` | `/api/auth/validate` | Bearer | Internal: decode token, return `{user_id, role, city_zone_id}` |
| `GET` | `/api/auth/city-zones` | None | List all city zones (public) |
| `GET` | `/health` | None | Health check |

## Example: Register a Worker

```bash
curl -X POST http://localhost:8001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "driver@example.com",
    "password": "securepass123",
    "display_name": "Ali Hassan",
    "role": "worker",
    "city_zone_id": "<uuid-from-city-zones>"
  }'
```

## Database Migrations

Three migration files run in order:

1. `0001_initial_tables` — All 10 tables with constraints and indexes
2. `0002_views` — `zone_earnings_summary` view and `monthly_worker_totals` materialized view
3. `0003_rls` — Row-Level Security policies on `shift_logs`

```bash
alembic upgrade head      # apply all
alembic downgrade base    # revert all
alembic history           # show migration history
```

## Environment Variables

Loaded from `../../.env` (project root):

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@host:5432/fairgig` |
| `JWT_SECRET` | 256-bit secret for signing JWTs |
