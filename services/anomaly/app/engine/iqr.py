def detect_rate_outliers(earnings: list) -> list:
    valid = []
    for e in earnings:
        hours = float(e["hours_worked"])
        if hours > 0:
            hourly = float(e["net_received"]) / hours
            valid.append((e, hourly))

    if len(valid) < 4:
        return []

    rates = sorted([r for _, r in valid])
    n = len(rates)
    q1 = rates[n // 4]
    q3 = rates[3 * n // 4]
    iqr = q3 - q1

    lower_fence = q1 - 1.5 * iqr
    upper_fence = q3 + 1.5 * iqr

    anomalies = []
    for entry, hourly in valid:
        if hourly < lower_fence or hourly > upper_fence:
            anomalies.append({
                "type": "rate_spike",
                "severity": "medium" if hourly < lower_fence else "low",
                "shift_date": entry["shift_date"],
                "platform": entry["platform"],
                "metric": "effective_hourly_rate",
                "expected_range": {
                    "low": round(lower_fence, 2),
                    "high": round(upper_fence, 2),
                },
                "actual_value": round(hourly, 2),
                "deviation_score": round((hourly - q1) / iqr if iqr > 0 else 0, 2),
            })
    return anomalies
