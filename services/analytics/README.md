# Analytics Service

FastAPI service on port 8005 — aggregate KPIs for advocate dashboard, anonymized queries via DB views.

> **Status:** Phase 2 (not yet implemented)

## Planned Endpoints

- `GET /api/analytics/dashboard` — Aggregate KPIs (parallel queries via asyncio.gather)
- `GET /api/analytics/commission` — Commission rate trends per platform
- `GET /api/analytics/income` — Income distribution by zone (P25/P50/P75)
- `GET /api/analytics/vulnerability` — Workers with >20% MoM income drops

All queries target the `zone_earnings_summary` view — never raw `shift_logs`.
