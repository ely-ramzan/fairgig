from statistics import mean, stdev
from collections import defaultdict


def detect_unusual_deductions(earnings: list) -> list:
    by_platform = defaultdict(list)
    for e in earnings:
        if float(e["gross_earned"]) > 0:
            rate = float(e["platform_deductions"]) / float(e["gross_earned"])
            by_platform[e["platform"]].append((e, rate))

    anomalies = []
    for platform, entries in by_platform.items():
        rates = [r for _, r in entries]
        if len(rates) < 3:
            continue

        mu = mean(rates)
        sd = stdev(rates) if len(rates) > 1 else 0.001

        for entry, rate in entries:
            z = (rate - mu) / sd if sd > 0 else 0
            if abs(z) > 2.0:
                severity = "low" if abs(z) < 2.5 else ("medium" if abs(z) < 3.0 else "high")
                anomalies.append({
                    "type": "unusual_deduction",
                    "severity": severity,
                    "shift_date": entry["shift_date"],
                    "platform": platform,
                    "metric": "commission_rate",
                    "expected_range": {
                        "low": round((mu - 2 * sd) * 100, 1),
                        "high": round((mu + 2 * sd) * 100, 1),
                    },
                    "actual_value": round(rate * 100, 1),
                    "deviation_score": round(z, 2),
                })
    return anomalies
