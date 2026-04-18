def detect_income_drops(earnings: list) -> list:
    sorted_earnings = sorted(earnings, key=lambda e: e["shift_date"])
    anomalies = []

    for i, e in enumerate(sorted_earnings):
        if i < 7:
            continue

        window = sorted_earnings[max(0, i - 7):i]
        avg_net = sum(float(w["net_received"]) for w in window) / len(window)
        current_net = float(e["net_received"])

        if avg_net > 0 and current_net < avg_net * 0.70:
            drop_pct = round((1 - current_net / avg_net) * 100, 1)
            anomalies.append({
                "type": "income_drop",
                "severity": "high" if drop_pct > 40 else "medium",
                "shift_date": e["shift_date"],
                "platform": e["platform"],
                "metric": "net_received_vs_rolling_avg",
                "expected_range": {
                    "low": round(avg_net * 0.70, 2),
                    "high": round(avg_net * 1.30, 2),
                },
                "actual_value": current_net,
                "deviation_score": round(-drop_pct / 10, 2),
            })
    return anomalies
