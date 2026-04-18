from collections import defaultdict


def detect_mom_drops(earnings: list) -> list:
    monthly = defaultdict(float)
    for e in earnings:
        month_key = e["shift_date"][:7]
        monthly[month_key] += float(e["net_received"])

    months = sorted(monthly.keys())
    anomalies = []

    for i in range(1, len(months)):
        prev = monthly[months[i - 1]]
        curr = monthly[months[i]]

        if prev > 0 and curr < prev * 0.80:
            drop_pct = round((1 - curr / prev) * 100, 1)
            anomalies.append({
                "type": "mom_drop",
                "severity": "high",
                "shift_date": f"{months[i]}-01",
                "platform": "all",
                "metric": "monthly_net_income",
                "expected_range": {
                    "low": round(prev * 0.80, 2),
                    "high": round(prev * 1.20, 2),
                },
                "actual_value": round(curr, 2),
                "deviation_score": round(-drop_pct / 10, 2),
            })
    return anomalies
