# Anomaly Detection Service

FastAPI service on port 8003 — statistical analysis engine using Z-score, IQR, rolling average, and MoM methods.

> **Status:** Phase 2 (not yet implemented)

## Planned Endpoints

- `POST /api/anomaly/detect` — Accepts earnings history array, returns detected anomalies with explanations

## Detection Methods

- **Z-score** on commission rates per platform (threshold: |Z| > 2.0)
- **IQR** on effective hourly rates
- **Rolling average** comparison for income drops (current < 70% of 7-day avg)
- **Month-over-month** total comparison (>20% drop = high severity)
- **Hours sanity check** (>16 hours in single shift)
