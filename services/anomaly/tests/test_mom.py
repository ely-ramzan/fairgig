"""
Month-over-month detection tests — detect_mom_drops()

Groups earnings by month. Flags month N if total < 80% of month N-1 total.
Needs at least 2 distinct months.
"""
import pytest
from app.engine.mom import detect_mom_drops


def make_entry(date, net, platform="Careem"):
    return {
        "shift_date": date,
        "platform": platform,
        "gross_earned": net / 0.78,
        "platform_deductions": net / 0.78 * 0.22,
        "net_received": float(net),
        "hours_worked": 6.0,
    }


# Jan: 10 × 2000 = 20000, Feb: 10 × 2000 = 20000 → stable, no drop
STABLE_2_MONTHS = (
    [make_entry(f"2026-01-{i:02d}", net=2000) for i in range(1, 11)] +
    [make_entry(f"2026-02-{i:02d}", net=2000) for i in range(1, 11)]
)

# Jan: 20000, Feb: 15000 → 75% of Jan → flag (< 80%)
DROP_2_MONTHS = (
    [make_entry(f"2026-01-{i:02d}", net=2000) for i in range(1, 11)] +
    [make_entry(f"2026-02-{i:02d}", net=1500) for i in range(1, 11)]
)

# Jan: 20000, Feb: 17000 → 85% of Jan → no flag (> 80%)
SLIGHT_DROP = (
    [make_entry(f"2026-01-{i:02d}", net=2000) for i in range(1, 11)] +
    [make_entry(f"2026-02-{i:02d}", net=1700) for i in range(1, 11)]
)

# Only January entries — single month, can't compute MoM
SINGLE_MONTH = [make_entry(f"2026-01-{i:02d}", net=2000) for i in range(1, 11)]


class TestInsufficientData:
    def test_single_month_no_anomaly(self):
        result = detect_mom_drops(SINGLE_MONTH)
        assert result == [], f"Single month can't do MoM, got {result}"

    def test_empty_returns_empty(self):
        assert detect_mom_drops([]) == []


class TestNormalData:
    def test_stable_months_no_anomaly(self):
        result = detect_mom_drops(STABLE_2_MONTHS)
        assert result == [], f"Stable months should not trigger, got {result}"

    def test_slight_drop_no_anomaly(self):
        """85% of prior month is above the 80% threshold"""
        result = detect_mom_drops(SLIGHT_DROP)
        assert result == [], f"85% retention should not trigger (threshold 80%), got {result}"


class TestDropDetection:
    def test_detects_25_percent_mom_drop(self):
        result = detect_mom_drops(DROP_2_MONTHS)
        assert len(result) > 0, "Should detect the 25% MoM income drop"

    def test_drop_type_is_mom_drop(self):
        result = detect_mom_drops(DROP_2_MONTHS)
        types = {a["type"] for a in result}
        assert "mom_drop" in types

    def test_drop_severity_is_high(self):
        """All MoM drops are high severity per spec"""
        result = detect_mom_drops(DROP_2_MONTHS)
        for a in result:
            assert a["severity"] == "high"

    def test_drop_shift_date_is_feb(self):
        """shift_date should be first of the drop month"""
        result = detect_mom_drops(DROP_2_MONTHS)
        assert any(a["shift_date"].startswith("2026-02") for a in result)

    def test_drop_platform_is_all(self):
        """MoM is cross-platform — platform field should be 'all'"""
        result = detect_mom_drops(DROP_2_MONTHS)
        for a in result:
            assert a["platform"] == "all"

    def test_drop_actual_value_is_feb_total(self):
        result = detect_mom_drops(DROP_2_MONTHS)
        anomaly = result[0]
        # Feb total = 10 × 1500 = 15000
        assert anomaly["actual_value"] == pytest.approx(15000.0, rel=0.01)

    def test_drop_expected_range_low_is_80_percent_of_jan(self):
        result = detect_mom_drops(DROP_2_MONTHS)
        anomaly = result[0]
        # 80% of 20000 = 16000
        assert anomaly["expected_range"]["low"] == pytest.approx(16000.0, rel=0.01)

    def test_three_months_detects_only_drop_month(self):
        """Jan stable, Feb drop, Mar stable — only Feb flagged"""
        three_months = (
            [make_entry(f"2026-01-{i:02d}", net=2000) for i in range(1, 11)] +
            [make_entry(f"2026-02-{i:02d}", net=1500) for i in range(1, 11)] +  # drop
            [make_entry(f"2026-03-{i:02d}", net=1600) for i in range(1, 11)]    # ~107% of Feb, no drop
        )
        result = detect_mom_drops(three_months)
        flagged_months = [a["shift_date"][:7] for a in result]
        assert "2026-02" in flagged_months
        assert "2026-03" not in flagged_months


class TestResultStructure:
    def test_anomaly_has_required_keys(self):
        result = detect_mom_drops(DROP_2_MONTHS)
        assert len(result) > 0
        required = {"type", "severity", "shift_date", "platform", "metric",
                    "expected_range", "actual_value", "deviation_score"}
        for key in required:
            assert key in result[0], f"Missing key: {key}"

    def test_metric_is_monthly_net_income(self):
        result = detect_mom_drops(DROP_2_MONTHS)
        for a in result:
            assert a["metric"] == "monthly_net_income"
