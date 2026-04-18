"""
Rolling average tests — detect_income_drops()

Flags shifts where net_received < 70% of the 7-shift rolling average
that precedes it. Needs >= 8 entries (7 prior + current).
"""
import pytest
from app.engine.rolling import detect_income_drops


def make_entry(date, net, platform="Careem", hours=6):
    return {
        "shift_date": date,
        "platform": platform,
        "gross_earned": net / 0.78,
        "platform_deductions": net / 0.78 * 0.22,
        "net_received": float(net),
        "hours_worked": float(hours),
    }


# 8 stable entries — no drop
STABLE_8 = [make_entry(f"2026-01-{i:02d}", net=2000) for i in range(1, 9)]

# 7 normal + 1 drop to 50% of average (2000 → 1000, which is < 70% of 2000)
DROP_8 = [
    make_entry(f"2026-01-{i:02d}", net=2000) for i in range(1, 8)
] + [make_entry("2026-01-08", net=1000)]  # 50% of average → flag

# 7 entries that slightly dip to 71% — should NOT trigger (above threshold)
SLIGHT_DIP = [
    make_entry(f"2026-01-{i:02d}", net=2000) for i in range(1, 8)
] + [make_entry("2026-01-08", net=1420)]  # 71% of 2000 → no flag

# Only 7 entries — no 8th entry to evaluate against rolling window
ONLY_7 = [make_entry(f"2026-01-{i:02d}", net=2000) for i in range(1, 8)]


class TestInsufficientData:
    def test_fewer_than_8_entries_no_anomaly(self):
        result = detect_income_drops(ONLY_7)
        assert result == [], f"7 entries can't compute rolling avg for any, got {result}"

    def test_empty_returns_empty(self):
        assert detect_income_drops([]) == []

    def test_single_entry_returns_empty(self):
        assert detect_income_drops([make_entry("2026-01-01", 2000)]) == []


class TestNormalData:
    def test_stable_earnings_no_anomaly(self):
        result = detect_income_drops(STABLE_8)
        assert result == [], f"Stable earnings should not trigger anomaly, got {result}"

    def test_slight_dip_no_anomaly(self):
        """71% of average is above the 70% threshold — should not flag"""
        result = detect_income_drops(SLIGHT_DIP)
        assert result == [], f"71% dip should not trigger (threshold is <70%), got {result}"


class TestDropDetection:
    def test_detects_50_percent_drop(self):
        result = detect_income_drops(DROP_8)
        assert len(result) > 0, "Should detect a 50% income drop"

    def test_drop_on_correct_date(self):
        result = detect_income_drops(DROP_8)
        dates = [a["shift_date"] for a in result]
        assert "2026-01-08" in dates

    def test_drop_type_is_income_drop(self):
        result = detect_income_drops(DROP_8)
        types = {a["type"] for a in result}
        assert "income_drop" in types

    def test_50_percent_drop_is_high_severity(self):
        """Drop > 40% → high severity"""
        result = detect_income_drops(DROP_8)
        anomaly = next(a for a in result if a["shift_date"] == "2026-01-08")
        assert anomaly["severity"] == "high", (
            f"50% drop should be high severity, got {anomaly['severity']}"
        )

    def test_drop_actual_value_matches_net(self):
        result = detect_income_drops(DROP_8)
        anomaly = next(a for a in result if a["shift_date"] == "2026-01-08")
        assert anomaly["actual_value"] == 1000.0

    def test_drop_expected_range_reflects_70_percent_floor(self):
        result = detect_income_drops(DROP_8)
        anomaly = next(a for a in result if a["shift_date"] == "2026-01-08")
        # 70% of 2000 avg = 1400
        assert anomaly["expected_range"]["low"] == pytest.approx(1400.0, rel=0.05)

    def test_medium_severity_for_30_to_40_percent_drop(self):
        """Drop of 35% → medium severity"""
        medium_drop = [
            make_entry(f"2026-01-{i:02d}", net=2000) for i in range(1, 8)
        ] + [make_entry("2026-01-08", net=1300)]  # 35% drop
        result = detect_income_drops(medium_drop)
        assert len(result) > 0
        assert result[0]["severity"] == "medium"


class TestResultStructure:
    def test_anomaly_has_required_keys(self):
        result = detect_income_drops(DROP_8)
        assert len(result) > 0
        required = {"type", "severity", "shift_date", "platform", "metric",
                    "expected_range", "actual_value", "deviation_score"}
        for key in required:
            assert key in result[0], f"Missing key: {key}"
