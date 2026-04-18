"""
IQR detection tests — detect_rate_outliers()

Flags shifts where effective hourly rate (net/hours) is outside
Q1 - 1.5*IQR or Q3 + 1.5*IQR. Needs >= 4 entries.
"""
import pytest
from app.engine.iqr import detect_rate_outliers


def make_entry(date, net, hours=6, platform="Careem", gross=2500, deductions=500):
    return {
        "shift_date": date,
        "platform": platform,
        "gross_earned": float(gross),
        "platform_deductions": float(deductions),
        "net_received": float(net),
        "hours_worked": float(hours),
    }


# All earn ~PKR 325/hr — consistent, no outliers
NORMAL_8 = [
    make_entry(f"2026-01-{i:02d}", net=1950, hours=6)
    for i in range(1, 9)
]

# 7 normal entries + 1 extremely low outlier (PKR 200/hr vs ~325/hr)
LOW_OUTLIER = [
    make_entry(f"2026-01-{i:02d}", net=1950, hours=6)
    for i in range(1, 8)
] + [make_entry("2026-01-08", net=600, hours=6)]  # 100/hr — far below fence

# 7 normal entries + 1 extremely high outlier
HIGH_OUTLIER = [
    make_entry(f"2026-01-{i:02d}", net=1950, hours=6)
    for i in range(1, 8)
] + [make_entry("2026-01-08", net=9000, hours=6)]  # 1500/hr — far above fence


class TestNormalData:
    def test_consistent_rates_no_anomaly(self):
        result = detect_rate_outliers(NORMAL_8)
        assert result == [], f"Consistent rates should produce no anomalies, got {result}"

    def test_returns_list(self):
        result = detect_rate_outliers(NORMAL_8)
        assert isinstance(result, list)


class TestEdgeCases:
    def test_fewer_than_4_entries_returns_empty(self):
        entries = [make_entry(f"2026-01-0{i}", net=1950, hours=6) for i in range(1, 4)]
        result = detect_rate_outliers(entries)
        assert result == [], f"< 4 entries should return empty, got {result}"

    def test_empty_returns_empty(self):
        assert detect_rate_outliers([]) == []

    def test_zero_hours_entry_skipped(self):
        entries = NORMAL_8 + [make_entry("2026-01-09", net=1000, hours=0)]
        # Should not raise, zero hours entry is skipped
        result = detect_rate_outliers(entries)
        assert isinstance(result, list)


class TestLowOutlierDetection:
    def test_detects_very_low_hourly_rate(self):
        result = detect_rate_outliers(LOW_OUTLIER)
        assert len(result) > 0, "Should detect the very low hourly rate outlier"

    def test_low_outlier_on_correct_date(self):
        result = detect_rate_outliers(LOW_OUTLIER)
        dates = [a["shift_date"] for a in result]
        assert "2026-01-08" in dates

    def test_low_outlier_type_is_rate_spike(self):
        result = detect_rate_outliers(LOW_OUTLIER)
        types = {a["type"] for a in result}
        assert "rate_spike" in types

    def test_low_outlier_severity_is_medium(self):
        """Below lower fence → medium severity"""
        result = detect_rate_outliers(LOW_OUTLIER)
        outlier = next(a for a in result if a["shift_date"] == "2026-01-08")
        assert outlier["severity"] == "medium"


class TestHighOutlierDetection:
    def test_detects_very_high_hourly_rate(self):
        result = detect_rate_outliers(HIGH_OUTLIER)
        assert len(result) > 0, "Should detect the very high hourly rate outlier"

    def test_high_outlier_on_correct_date(self):
        result = detect_rate_outliers(HIGH_OUTLIER)
        dates = [a["shift_date"] for a in result]
        assert "2026-01-08" in dates

    def test_high_outlier_severity_is_low(self):
        """Above upper fence → low severity"""
        result = detect_rate_outliers(HIGH_OUTLIER)
        outlier = next(a for a in result if a["shift_date"] == "2026-01-08")
        assert outlier["severity"] == "low"


class TestResultStructure:
    def test_anomaly_has_required_keys(self):
        result = detect_rate_outliers(LOW_OUTLIER)
        assert len(result) > 0
        required = {"type", "severity", "shift_date", "platform", "metric",
                    "expected_range", "actual_value", "deviation_score"}
        for key in required:
            assert key in result[0], f"Missing key: {key}"

    def test_expected_range_has_low_and_high(self):
        result = detect_rate_outliers(LOW_OUTLIER)
        assert "low" in result[0]["expected_range"]
        assert "high" in result[0]["expected_range"]

    def test_metric_is_effective_hourly_rate(self):
        result = detect_rate_outliers(LOW_OUTLIER)
        for a in result:
            assert a["metric"] == "effective_hourly_rate"
