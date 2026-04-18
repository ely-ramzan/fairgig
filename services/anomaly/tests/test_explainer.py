"""
Explainer tests — generate_explanation()

Generates a human-readable string from an anomaly dict.
Must produce non-empty strings for all known anomaly types.
"""
import pytest
from app.engine.explainer import generate_explanation

BASE = {
    "shift_date": "2026-01-18",
    "platform": "Careem",
    "actual_value": 30.0,
    "expected_range": {"low": 20.0, "high": 25.0},
    "deviation_score": 2.5,
    "metric": "commission_rate",
}


def make_anomaly(type_: str, **overrides):
    return {**BASE, "type": type_, **overrides}


class TestExplanationGeneration:
    def test_returns_string(self):
        result = generate_explanation(make_anomaly("unusual_deduction"))
        assert isinstance(result, str)

    def test_non_empty_for_unusual_deduction(self):
        result = generate_explanation(make_anomaly("unusual_deduction"))
        assert len(result) > 10, "Explanation should be a meaningful sentence"

    def test_non_empty_for_income_drop(self):
        result = generate_explanation(make_anomaly("income_drop", metric="net_received_vs_rolling_avg"))
        assert len(result) > 10

    def test_non_empty_for_rate_spike(self):
        result = generate_explanation(make_anomaly("rate_spike", metric="effective_hourly_rate"))
        assert len(result) > 10

    def test_non_empty_for_mom_drop(self):
        result = generate_explanation(make_anomaly("mom_drop", platform="all", metric="monthly_net_income"))
        assert len(result) > 10

    def test_non_empty_for_hours_mismatch(self):
        result = generate_explanation(make_anomaly("hours_mismatch", metric="hours_worked",
                                                    actual_value=18.0,
                                                    expected_range={"low": 1.0, "high": 16.0}))
        assert len(result) > 10

    def test_unknown_type_returns_fallback(self):
        """Unknown type should return a fallback string, not raise"""
        result = generate_explanation(make_anomaly("totally_unknown_type"))
        assert isinstance(result, str)
        assert len(result) > 0


class TestExplanationContent:
    def test_unusual_deduction_mentions_commission(self):
        result = generate_explanation(make_anomaly("unusual_deduction"))
        assert any(word in result.lower() for word in ("commission", "deduction", "rate"))

    def test_unusual_deduction_mentions_platform(self):
        result = generate_explanation(make_anomaly("unusual_deduction"))
        assert "Careem" in result

    def test_income_drop_mentions_earnings(self):
        result = generate_explanation(make_anomaly("income_drop"))
        assert any(word in result.lower() for word in ("earn", "income", "pkr"))

    def test_hours_mismatch_mentions_hours(self):
        result = generate_explanation(make_anomaly("hours_mismatch", actual_value=18.0,
                                                    expected_range={"low": 1.0, "high": 16.0}))
        assert any(word in result.lower() for word in ("hour", "shift"))

    def test_mom_drop_mentions_month(self):
        result = generate_explanation(make_anomaly("mom_drop", platform="all"))
        assert any(word in result.lower() for word in ("month", "income", "pkr"))
