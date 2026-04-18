TEMPLATES = {
    "unusual_deduction": (
        "Your commission rate on {platform} on {shift_date} was {actual_value}%, "
        "which is outside your normal range of {expected_low}%-{expected_high}%. "
        "This may indicate a platform commission rate change."
    ),
    "income_drop": (
        "Your earnings of PKR {actual_value} on {shift_date} were significantly "
        "below your recent average (PKR {expected_low} - {expected_high}). "
        "This could reflect fewer trips or reduced demand in your area."
    ),
    "rate_spike": (
        "Your effective hourly rate on {platform} on {shift_date} was PKR {actual_value}/hr, "
        "outside the typical range of PKR {expected_low}-{expected_high}/hr."
    ),
    "mom_drop": (
        "Your total income in {shift_date} dropped to PKR {actual_value}, "
        "below the expected range of PKR {expected_low}-{expected_high} based on "
        "the prior month. This represents a significant month-over-month decline."
    ),
    "hours_mismatch": (
        "A shift of {actual_value} hours on {shift_date} on {platform} seems unusually long. "
        "The expected range is {expected_low}-{expected_high} hours. Please verify this entry."
    ),
}


def generate_explanation(anomaly: dict) -> str:
    template = TEMPLATES.get(anomaly["type"])
    if template is None:
        return f"Anomaly detected on {anomaly.get('shift_date', 'unknown date')}."
    return template.format(
        platform=anomaly.get("platform", "unknown"),
        shift_date=anomaly["shift_date"],
        actual_value=anomaly["actual_value"],
        expected_low=anomaly["expected_range"]["low"],
        expected_high=anomaly["expected_range"]["high"],
    )
