# Earnings Service

FastAPI service on port 8002 — shift CRUD, CSV import, screenshot management, and verification workflow.

> **Status:** Phase 2 (not yet implemented)

## Planned Endpoints

- `GET/POST /api/earnings/shifts` — List and create shift logs
- `GET/PUT/DELETE /api/earnings/shifts/{id}` — Manage individual shifts
- `POST /api/earnings/shifts/import` — Bulk CSV import
- `POST /api/earnings/screenshots/{shift_id}` — Upload screenshot to Cloudinary
- `GET /api/earnings/verification/queue` — Verifier FIFO queue
- `PUT /api/earnings/verification/{shift_id}` — Submit verification decision
