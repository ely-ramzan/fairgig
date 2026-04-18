def detect_hours_issues(earnings: list) -> list:
    anomalies = []
    for e in earnings:
        hours = float(e["hours_worked"])
        net = float(e["net_received"])

        if hours > 16:
            anomalies.append({
                "type": "hours_mismatch",
                "severity": "medium" if hours > 20 else "low",
                "shift_date": e["shift_date"],
                "platform": e["platform"],
                "metric": "hours_worked",
                "expected_range": {"low": 1.0, "high": 16.0},
                "actual_value": hours,
                "deviation_score": round((hours - 10) / 3, 2),
            })

        if hours > 0:
            hourly = net / hours
            if hourly < 100:
                anomalies.append({
                    "type": "rate_spike",
                    "severity": "medium",
                    "shift_date": e["shift_date"],
                    "platform": e["platform"],
                    "metric": "hourly_rate_below_minimum",
                    "expected_range": {"low": 100, "high": 500},
                    "actual_value": round(hourly, 2),
                    "deviation_score": round((hourly - 200) / 50, 2),
                })
    return anomalies
