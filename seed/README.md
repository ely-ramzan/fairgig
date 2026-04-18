# Seed Script

Populates the FairGig database with realistic demo data for development and judging.

## What gets seeded

| Table | Count |
|-------|-------|
| City zones | 6 (Lahore neighborhoods) |
| Platforms | 5 (Careem, Foodpanda, Uber, InDriver, Fiverr) |
| Workers | 210 |
| Verifiers | 10 |
| Advocates | 5 |
| Shift logs | ~8,000 |
| Screenshots | ~3,000 |
| Verifications | ~2,400 |
| Grievances | 67 |
| Grievance tags | ~130 |
| Anomaly results | ~43 |
| File uploads | 12 |

## Usage

```bash
cd seed
python -m venv .venv && .venv\Scripts\activate   # Windows
# source .venv/bin/activate                       # macOS/Linux
pip install -r requirements.txt
python seed.py
```

The script is **idempotent** — running it twice truncates all tables first.

## Data Distributions

- **Careem commission spike** — Week 8 (Feb 16-22, 2026): commission jumps from 22% to 30%, triggers anomaly detection
- **DHA earns ~15% more** than Johar Town (verifiable via `zone_earnings_summary` view)
- **5 workers** have >20% month-over-month income drops in March (vulnerability flags)
- **12 workers** filed `commission_change` complaints about Careem in the same week (complaint cluster)
- Default password for all seeded users: `fairgig123`

## Verify After Seeding

```sql
-- Check k-anonymized aggregates
SELECT zone_name, platform_name, week, worker_count, median_net
FROM zone_earnings_summary
ORDER BY week DESC
LIMIT 10;

-- Check MoM totals
SELECT worker_id, month, total_net
FROM monthly_worker_totals
ORDER BY month DESC
LIMIT 10;
```
