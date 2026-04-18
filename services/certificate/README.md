# Certificate Renderer Service

FastAPI service on port 8006 — stateless HTML income certificate generation using Jinja2 templates.

> **Status:** Phase 2 (not yet implemented)

## Planned Endpoints

- `GET /api/certificate/{worker_id}?start=&end=&verified_only=true` — Generate printable income certificate

## Certificate Features

- Print-friendly HTML with `@media print` CSS and A4 sizing
- Shows total gross, deductions, net, hours, effective hourly rate, per-platform breakdown
- Certificate number (UUID short hash) for reference
- Disclaimer: "This certificate reflects self-reported earnings, verified where possible."
- Configurable: show only verified earnings or all earnings
