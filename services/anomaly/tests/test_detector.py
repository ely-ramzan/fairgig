"""
Orchestrator tests — run_all_detections()

The master function that calls all 5 detection methods, deduplicates,
adds explanations, and sorts by severity (high first).
"""
import pytest
from app.engine.detector import run_all_detections, _severity_rank


def make_entry(date, deductions, gross=2500, net=None, hours=6, platform="Careem"):
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


# 5 normal entries — no anomaly expected from any method
CLEAN_5 = [
    make_entry(f"2026-01-{i:02d}", deductions=550)
    for i in range(1, 6)
]

# 7 entries: 6 normal at ~22% commission + 1 spike at 30% on 2026-01-18
# Z = 6/sqrt(7) ≈ 2.268 > 2.0 threshold — guaranteed detection
CANONICAL_7 = [
    make_entry("2026-01-13", 550),
    make_entry("2026-01-14", 550),
    make_entry("2026-01-15", 550),
    make_entry("2026-01-16", 506, gross=2300),
    make_entry("2026-01-17", 528, gross=2400),
    make_entry("2026-01-18", 750),   # 30% spike
    make_entry("2026-01-19", 484, gross=2200),
]

# All identical values — no statistical variance
IDENTICAL_5 = [
    make_entry(f"2026-01-{i:02d}", deductions=440, gross=2000)
    for i in range(1, 6)
]


class TestMinimumDataGuard:
    def test_empty_returns_empty(self):
        result = run_all_detections([])
        assert result == []

    def test_one_entry_returns_empty(self):
        result = run_all_detections([make_entry("2026-01-01", 500)])
        assert result == []

    def test_two_entries_returns_empty(self):
        result = run_all_detections([
            make_entry("2026-01-01", 500),
            make_entry("2026-01-02", 500),
        ])
        assert result == []

    def test_three_entries_allowed(self):
        """3 entries is the minimum — should not immediately return []"""
        three = [make_entry(f"2026-01-0{i}", 550) for i in range(1, 4)]
        result = run_all_detections(three)
        assert isinstance(result, list)  # Does not raise; may or may not have anomalies


class TestNormalData:
    def test_clean_data_no_anomalies(self):
        result = run_all_detections(CLEAN_5)
        assert result == [], f"Clean data should produce no anomalies, got {result}"

    def test_identical_values_no_anomalies(self):
        result = run_all_detections(IDENTICAL_5)
        assert result == [], f"Identical values should produce no anomalies, got {result}"


class TestAnomalyDetection:
    def test_detects_commission_spike(self):
        result = run_all_detections(CANONICAL_7)
        assert len(result) > 0, "Should detect the 30% commission spike"

    def test_returns_list_of_dicts(self):
        result = run_all_detections(CANONICAL_7)
        for a in result:
            assert isinstance(a, dict)


class TestExplanationAdded:
    def test_all_anomalies_have_explanation(self):
        result = run_all_detections(CANONICAL_7)
        for a in result:
            assert "explanation" in a, f"Missing explanation in {a}"
            assert isinstance(a["explanation"], str)
            assert len(a["explanation"]) > 0, "Explanation should not be empty"


class TestSortOrder:
    def test_sorted_high_severity_first(self):
        """High severity anomalies must appear before lower ones"""
        # Craft data that produces multiple anomaly types
        data = (
            [make_entry(f"2026-01-{i:02d}", deductions=550) for i in range(1, 8)] +
            [make_entry("2026-01-08", deductions=550, net=500)]  # very low net → income_drop
        )
        result = run_all_detections(data)
        if len(result) > 1:
            ranks = [_severity_rank(a["severity"]) for a in result]
            assert ranks == sorted(ranks, reverse=True), (
                f"Results should be sorted high→low severity, got {[a['severity'] for a in result]}"
            )

    def test_severity_rank_helper(self):
        assert _severity_rank("high") > _severity_rank("medium")
        assert _severity_rank("medium") > _severity_rank("low")
        assert _severity_rank("low") > 0
        assert _severity_rank("unknown") == 0


class TestDeduplication:
    def test_no_duplicate_date_type_combos(self):
        """Same shift_date + same anomaly type should only appear once"""
        result = run_all_detections(CANONICAL_7)
        seen = set()
        for a in result:
            key = (a["shift_date"], a["type"])
            assert key not in seen, f"Duplicate anomaly: {key}"
            seen.add(key)


class TestResultStructure:
    def test_every_anomaly_has_required_fields(self):
        result = run_all_detections(CANONICAL_7)
        required = {"type", "severity", "shift_date", "platform", "metric",
                    "expected_range", "actual_value", "deviation_score", "explanation"}
        for a in result:
            for field in required:
                assert field in a, f"Missing field '{field}' in anomaly: {a}"

    def test_severity_values_are_valid(self):
        result = run_all_detections(CANONICAL_7)
        for a in result:
            assert a["severity"] in ("low", "medium", "high")

    def test_type_values_are_valid(self):
        valid_types = {
            "unusual_deduction", "income_drop", "rate_spike",
            "hours_mismatch", "mom_drop"
        }
        result = run_all_detections(CANONICAL_7)
        for a in result:
            assert a["type"] in valid_types, f"Invalid type: {a['type']}"
