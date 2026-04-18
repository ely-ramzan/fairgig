"""
Sanity check tests — detect_hours_issues()

Two checks:
  1. hours_worked > 16 → hours_mismatch anomaly
  2. effective hourly rate < PKR 100 → rate_spike anomaly
"""
import pytest
from app.engine.sanity import detect_hours_issues


def make_entry(date, hours, net, platform="Careem"):
    return {
        "shift_date": date,
        "platform": platform,
        "gross_earned": net / 0.78,
        "platform_deductions": net / 0.78 * 0.22,
        "net_received": float(net),
        "hours_worked": float(hours),
    }


class TestHoursCheck:
    def test_16_hours_no_flag(self):
        """Boundary: exactly 16 hours should NOT be flagged"""
        result = detect_hours_issues([make_entry("2026-01-01", hours=16, net=5000)])
        hours_flags = [a for a in result if a["type"] == "hours_mismatch"]
        assert hours_flags == [], f"16 hours should not be flagged, got {hours_flags}"

    def test_17_hours_flagged(self):
        result = detect_hours_issues([make_entry("2026-01-01", hours=17, net=5000)])
        hours_flags = [a for a in result if a["type"] == "hours_mismatch"]
        assert len(hours_flags) > 0, "17 hours should trigger hours_mismatch"

    def test_17_hours_severity_is_low(self):
        """17 hours (between 16 and 20) → low severity"""
        result = detect_hours_issues([make_entry("2026-01-01", hours=17, net=5000)])
        hours_flags = [a for a in result if a["type"] == "hours_mismatch"]
        assert hours_flags[0]["severity"] == "low"

    def test_21_hours_severity_is_medium(self):
        """Over 20 hours → medium severity"""
        result = detect_hours_issues([make_entry("2026-01-01", hours=21, net=6000)])
        hours_flags = [a for a in result if a["type"] == "hours_mismatch"]
        assert len(hours_flags) > 0
        assert hours_flags[0]["severity"] == "medium"

    def test_hours_flag_on_correct_date(self):
        result = detect_hours_issues([make_entry("2026-03-15", hours=18, net=5000)])
        assert any(a["shift_date"] == "2026-03-15" for a in result)

    def test_hours_flag_metric_is_hours_worked(self):
        result = detect_hours_issues([make_entry("2026-01-01", hours=18, net=5000)])
        for a in result:
            if a["type"] == "hours_mismatch":
                assert a["metric"] == "hours_worked"

    def test_hours_flag_expected_range(self):
        """Expected range for hours is 1-16"""
        result = detect_hours_issues([make_entry("2026-01-01", hours=18, net=5000)])
        flag = next(a for a in result if a["type"] == "hours_mismatch")
        assert flag["expected_range"]["low"] == 1.0
        assert flag["expected_range"]["high"] == 16.0

    def test_hours_actual_value_matches_input(self):
        result = detect_hours_issues([make_entry("2026-01-01", hours=18, net=5000)])
        flag = next(a for a in result if a["type"] == "hours_mismatch")
        assert flag["actual_value"] == 18.0


class TestMinimumWageCheck:
    def test_exactly_100_per_hour_no_flag(self):
        """Boundary: exactly PKR 100/hr should NOT be flagged"""
        result = detect_hours_issues([make_entry("2026-01-01", hours=6, net=600)])
        wage_flags = [a for a in result if a.get("metric") == "hourly_rate_below_minimum"]
        assert wage_flags == [], f"PKR 100/hr should not be flagged, got {wage_flags}"

    def test_below_100_per_hour_flagged(self):
        """PKR 90/hr (net=540 for 6h) should trigger wage flag"""
        result = detect_hours_issues([make_entry("2026-01-01", hours=6, net=540)])
        wage_flags = [a for a in result if a.get("metric") == "hourly_rate_below_minimum"]
        assert len(wage_flags) > 0, "PKR 90/hr should trigger below-minimum flag"

    def test_below_minimum_type_is_rate_spike(self):
        result = detect_hours_issues([make_entry("2026-01-01", hours=6, net=540)])
        wage_flags = [a for a in result if a.get("metric") == "hourly_rate_below_minimum"]
        assert wage_flags[0]["type"] == "rate_spike"

    def test_below_minimum_severity_is_medium(self):
        result = detect_hours_issues([make_entry("2026-01-01", hours=6, net=540)])
        wage_flags = [a for a in result if a.get("metric") == "hourly_rate_below_minimum"]
        assert wage_flags[0]["severity"] == "medium"

    def test_zero_hours_skips_wage_check(self):
        """Zero hours → can't compute hourly rate → no division error"""
        result = detect_hours_issues([make_entry("2026-01-01", hours=0, net=1000)])
        assert isinstance(result, list)  # Does not raise

    def test_normal_wage_no_flag(self):
        """PKR 325/hr is well above minimum"""
        result = detect_hours_issues([make_entry("2026-01-01", hours=6, net=1950)])
        wage_flags = [a for a in result if a.get("metric") == "hourly_rate_below_minimum"]
        assert wage_flags == []


class TestCombinedFlags:
    def test_entry_can_trigger_both_hours_and_wage_flags(self):
        """21 hours, PKR 50/hr — both flags should fire"""
        result = detect_hours_issues([make_entry("2026-01-01", hours=21, net=1050)])
        types = [a["type"] for a in result]
        assert "hours_mismatch" in types
        # 1050/21 = 50/hr < 100 → rate_spike
        wage_flags = [a for a in result if a.get("metric") == "hourly_rate_below_minimum"]
        assert len(wage_flags) > 0

    def test_multiple_entries_each_checked_independently(self):
        entries = [
            make_entry("2026-01-01", hours=8, net=2000),   # normal
            make_entry("2026-01-02", hours=18, net=5000),  # hours flag
            make_entry("2026-01-03", hours=6, net=300),    # wage flag (50/hr)
        ]
        result = detect_hours_issues(entries)
        dates = {a["shift_date"] for a in result}
        assert "2026-01-01" not in dates
        assert "2026-01-02" in dates
        assert "2026-01-03" in dates
