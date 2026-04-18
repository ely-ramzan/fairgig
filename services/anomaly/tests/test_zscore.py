"""
Z-score detection tests — detect_unusual_deductions()

Detects shifts where commission rate deviates > 2 std devs from a
platform's mean rate. Needs >= 3 entries per platform to run.

Math note: With n entries (n-1 identical + 1 outlier), the Z-score of the outlier
is always (n-1)/sqrt(n), regardless of magnitude. To exceed Z=2.0 you need n>=6.
  n=6 → Z = 5/sqrt(6) ≈ 2.04  (low severity)
  n=7 → Z = 6/sqrt(7) ≈ 2.27  (low severity)
  n=9 → Z = 8/sqrt(9) ≈ 2.67  (medium severity)
"""
import pytest
from app.engine.zscore import detect_unusual_deductions


def make_entry(date, deductions, gross=2000, net=None, hours=6, platform="Careem"):
    if net is None:
        net = gross - deductions
    return {
        "shift_date": date,
        "platform": platform,
        "gross_earned": float(gross),
        "platform_deductions": float(deductions),
        "net_received": float(net),
        "hours_worked": float(hours),
    }


# 5 entries all at exactly 22% commission — no outlier
NORMAL_5 = [make_entry(f"2026-01-{i:02d}", deductions=440) for i in range(1, 6)]

# 6 normal entries at 22% + 1 spike at 30% on date "2026-01-07"
# Z_spike = 6/sqrt(7) ≈ 2.27 → low severity, reliably > 2.0 threshold
SPIKE_7 = [
    make_entry(f"2026-01-{i:02d}", deductions=440)  # 22%
    for i in range(1, 7)
] + [make_entry("2026-01-07", deductions=600)]       # 30% spike

SPIKE_DATE = "2026-01-07"

# All identical commission rates — std_dev = 0, Z-score undefined
IDENTICAL_7 = [make_entry(f"2026-01-{i:02d}", deductions=440) for i in range(1, 8)]

# Only 2 entries for this platform — skip (< 3 minimum)
TWO_ENTRIES = [
    make_entry("2026-01-15", deductions=750),
    make_entry("2026-01-16", deductions=690),
]


# ── Tests ──────────────────────────────────────────────────────────────────────

class TestNormalData:
    def test_no_anomaly_when_rates_consistent(self):
        result = detect_unusual_deductions(NORMAL_5)
        assert result == [], f"Expected no anomalies, got {result}"

    def test_returns_list(self):
        result = detect_unusual_deductions(NORMAL_5)
        assert isinstance(result, list)


class TestSpikeDetection:
    def test_detects_commission_spike(self):
        result = detect_unusual_deductions(SPIKE_7)
        assert len(result) > 0, "Should detect the 30% commission spike"

    def test_spike_is_on_correct_date(self):
        result = detect_unusual_deductions(SPIKE_7)
        dates = [a["shift_date"] for a in result]
        assert SPIKE_DATE in dates, f"Spike should be on {SPIKE_DATE}, got {dates}"

    def test_spike_type_is_unusual_deduction(self):
        result = detect_unusual_deductions(SPIKE_7)
        types = {a["type"] for a in result}
        assert "unusual_deduction" in types

    def test_spike_platform_is_correct(self):
        result = detect_unusual_deductions(SPIKE_7)
        anomaly = next(a for a in result if a["shift_date"] == SPIKE_DATE)
        assert anomaly["platform"] == "Careem"

    def test_spike_severity_is_valid(self):
        result = detect_unusual_deductions(SPIKE_7)
        anomaly = next(a for a in result if a["shift_date"] == SPIKE_DATE)
        assert anomaly["severity"] in ("low", "medium", "high")

    def test_spike_actual_value_approx_30_percent(self):
        result = detect_unusual_deductions(SPIKE_7)
        anomaly = next(a for a in result if a["shift_date"] == SPIKE_DATE)
        # 600/2000 = 30%
        assert abs(anomaly["actual_value"] - 30.0) < 1.0, (
            f"actual_value should be ~30%, got {anomaly['actual_value']}"
        )

    def test_spike_has_expected_range_keys(self):
        result = detect_unusual_deductions(SPIKE_7)
        anomaly = next(a for a in result if a["shift_date"] == SPIKE_DATE)
        assert "expected_range" in anomaly
        assert "low" in anomaly["expected_range"]
        assert "high" in anomaly["expected_range"]

    def test_spike_deviation_score_exceeds_threshold(self):
        """Z-score must exceed 2.0 to be flagged"""
        result = detect_unusual_deductions(SPIKE_7)
        anomaly = next(a for a in result if a["shift_date"] == SPIKE_DATE)
        assert abs(anomaly["deviation_score"]) > 2.0, (
            f"Z-score should exceed 2.0, got {anomaly['deviation_score']}"
        )

    def test_normal_entries_not_flagged(self):
        """Only the spike entry should be flagged, not the 6 normal ones"""
        result = detect_unusual_deductions(SPIKE_7)
        flagged_dates = {a["shift_date"] for a in result}
        normal_dates = {f"2026-01-{i:02d}" for i in range(1, 7)}
        assert flagged_dates.isdisjoint(normal_dates), (
            f"Normal entries should not be flagged: {flagged_dates & normal_dates}"
        )


class TestEdgeCases:
    def test_identical_rates_no_anomaly(self):
        """std_dev = 0 → Z-score undefined → no anomalies"""
        result = detect_unusual_deductions(IDENTICAL_7)
        assert result == [], f"Identical rates should not produce anomalies, got {result}"

    def test_fewer_than_3_entries_skipped(self):
        """Need at least 3 per platform to compute meaningful stats"""
        result = detect_unusual_deductions(TWO_ENTRIES)
        assert result == [], f"< 3 entries should be skipped, got {result}"

    def test_empty_earnings_returns_empty(self):
        result = detect_unusual_deductions([])
        assert result == []

    def test_single_entry_returns_empty(self):
        result = detect_unusual_deductions([make_entry("2026-01-01", deductions=500)])
        assert result == []

    def test_multi_platform_only_flags_spike_platform(self):
        """Normal Uber entries should not be flagged when Careem has a spike"""
        uber_normal = [
            make_entry(f"2026-01-{i:02d}", deductions=300, gross=2000, platform="Uber")
            for i in range(1, 7)
        ]
        result = detect_unusual_deductions(SPIKE_7 + uber_normal)
        flagged_platforms = {a["platform"] for a in result}
        assert "Uber" not in flagged_platforms, "Normal Uber entries should not be flagged"
        assert "Careem" in flagged_platforms


class TestResultStructure:
    def test_anomaly_has_required_keys(self):
        result = detect_unusual_deductions(SPIKE_7)
        assert len(result) > 0
        keys = {"type", "severity", "shift_date", "platform", "metric",
                "expected_range", "actual_value", "deviation_score"}
        for key in keys:
            assert key in result[0], f"Missing key: {key}"

    def test_severity_is_valid_value(self):
        result = detect_unusual_deductions(SPIKE_7)
        for a in result:
            assert a["severity"] in ("low", "medium", "high")

    def test_metric_is_commission_rate(self):
        result = detect_unusual_deductions(SPIKE_7)
        for a in result:
            assert a["metric"] == "commission_rate"
