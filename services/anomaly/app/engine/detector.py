from .zscore import detect_unusual_deductions
from .iqr import detect_rate_outliers
from .rolling import detect_income_drops
from .mom import detect_mom_drops
from .sanity import detect_hours_issues
from .explainer import generate_explanation


def run_all_detections(earnings: list) -> list:
    if len(earnings) < 3:
        return []

    anomalies = []
    anomalies.extend(detect_unusual_deductions(earnings))
    anomalies.extend(detect_rate_outliers(earnings))
    anomalies.extend(detect_income_drops(earnings))
    anomalies.extend(detect_mom_drops(earnings))
    anomalies.extend(detect_hours_issues(earnings))

    # Deduplicate: same (shift_date, type) → keep highest severity
    seen = {}
    for a in anomalies:
        key = (a["shift_date"], a["type"])
        if key not in seen or _severity_rank(a["severity"]) > _severity_rank(seen[key]["severity"]):
            seen[key] = a

    final = list(seen.values())
    for a in final:
        a["explanation"] = generate_explanation(a)

    final.sort(key=lambda x: (-_severity_rank(x["severity"]), x["shift_date"]))
    return final


def _severity_rank(s: str) -> int:
    return {"low": 1, "medium": 2, "high": 3}.get(s, 0)
