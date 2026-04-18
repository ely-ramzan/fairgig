# Grievance Service

Node.js + Express service on port 8004 — community bulletin board, complaint CRUD, clustering, and escalation.

> **Status:** Phase 2 (not yet implemented)

## Setup (when implemented)

```bash
cd services/grievance
npm install
npx prisma db pull        # introspects existing PostgreSQL tables
npx prisma generate       # generates typed Prisma client
node src/index.js
```

## Planned Endpoints

- `GET/POST /api/grievances` — List and create grievances
- `PUT /api/grievances/{id}` — Update status (escalate/resolve)
- `GET /api/grievances/search?q=` — Full-text search
- `GET /api/grievances/clusters` — Group by platform+category+week
- `GET/POST /api/grievances/{id}/tags` — Tag management
