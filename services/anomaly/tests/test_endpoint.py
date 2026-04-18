"""
FastAPI endpoint tests — POST /api/anomaly/detect

The judge-tested endpoint. No auth required (stateless, public).
Tests the full HTTP contract: request schema, response shape, edge cases.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

SPIKE_PAYLOAD = {
    "earnings": [
        {"shift_date": "2026-01-15", "platform": "Careem",
         "gross_earned": 2500, "platform_deductions": 550, "net_received": 1950, "hours_worked": 6},
        {"shift_date": "2026-01-16", "platform": "Careem",
         "gross_earned": 2300, "platform_deductions": 506, "net_received": 1794, "hours_worked": 5.5},
        {"shift_date": "2026-01-17", "platform": "Careem",
         "gross_earned": 2400, "platform_deductions": 528, "net_received": 1872, "hours_worked": 6},
        {"shift_date": "2026-01-18", "platform": "Careem",
         "gross_earned": 2600, "platform_deductions": 780, "net_received": 1820, "hours_worked": 7},
        {"shift_date": "2026-01-19", "platform": "Careem",
         "gross_earned": 2200, "platform_deductions": 484, "net_received": 1716, "hours_worked": 5},
    ]
}

CLEAN_PAYLOAD = {
    "earnings": [
        {"shift_date": f"2026-01-{i:02d}", "platform": "Careem",
         "gross_earned": 2500, "platform_deductions": 550, "net_received": 1950, "hours_worked": 6}
        for i in range(1, 6)
    ]
}


class TestHealthCheck:
    def test_health_returns_ok(self):
        resp = client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
        assert resp.json()["service"] == "anomaly"


class TestEmptyAndInsufficientData:
    def test_empty_earnings_returns_200(self):
        resp = client.post("/api/anomaly/detect", json={"earnings": []})
        assert resp.status_code == 200

    def test_empty_earnings_anomalies_found_is_zero(self):
        resp = client.post("/api/anomaly/detect", json={"earnings": []})
        assert resp.json()["anomalies_found"] == 0

    def test_empty_earnings_anomalies_list_is_empty(self):
        resp = client.post("/api/anomaly/detect", json={"earnings": []})
        assert resp.json()["anomalies"] == []

    def test_empty_earnings_has_summary(self):
        resp = client.post("/api/anomaly/detect", json={"earnings": []})
        assert "summary" in resp.json()
        assert len(resp.json()["summary"]) > 0

    def test_two_entries_returns_200(self):
        two = {"earnings": SPIKE_PAYLOAD["earnings"][:2]}
        resp = client.post("/api/anomaly/detect", json=two)
        assert resp.status_code == 200

    def test_two_entries_anomalies_found_is_zero(self):
        two = {"earnings": SPIKE_PAYLOAD["earnings"][:2]}
        resp = client.post("/api/anomaly/detect", json=two)
        assert resp.json()["anomalies_found"] == 0

    def test_two_entries_summary_mentions_insufficient(self):
        two = {"earnings": SPIKE_PAYLOAD["earnings"][:2]}
        resp = client.post("/api/anomaly/detect", json=two)
        assert "insufficient" in resp.json()["summary"].lower() or \
               "need" in resp.json()["summary"].lower()


class TestValidInput:
    def test_spike_data_returns_200(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        assert resp.status_code == 200

    def test_spike_data_detects_anomalies(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        assert resp.json()["anomalies_found"] > 0, (
            "Should detect anomaly in the 30% commission spike payload"
        )

    def test_spike_data_anomalies_list_non_empty(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        assert len(resp.json()["anomalies"]) > 0

    def test_clean_data_no_anomalies(self):
        resp = client.post("/api/anomaly/detect", json=CLEAN_PAYLOAD)
        assert resp.status_code == 200
        assert resp.json()["anomalies_found"] == 0

    def test_anomalies_found_matches_list_length(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        data = resp.json()
        assert data["anomalies_found"] == len(data["anomalies"])


class TestResponseSchema:
    def test_response_has_anomalies_found(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        assert "anomalies_found" in resp.json()

    def test_response_has_anomalies_list(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        assert "anomalies" in resp.json()
        assert isinstance(resp.json()["anomalies"], list)

    def test_response_has_summary(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        assert "summary" in resp.json()

    def test_each_anomaly_has_type(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        for a in resp.json()["anomalies"]:
            assert "type" in a

    def test_each_anomaly_has_severity(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        for a in resp.json()["anomalies"]:
            assert a["severity"] in ("low", "medium", "high")

    def test_each_anomaly_has_explanation(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        for a in resp.json()["anomalies"]:
            assert "explanation" in a
            assert len(a["explanation"]) > 0

    def test_each_anomaly_has_expected_range(self):
        resp = client.post("/api/anomaly/detect", json=SPIKE_PAYLOAD)
        for a in resp.json()["anomalies"]:
            assert "expected_range" in a
            assert "low" in a["expected_range"]
            assert "high" in a["expected_range"]


class TestValidationErrors:
    def test_missing_earnings_field_returns_422(self):
        resp = client.post("/api/anomaly/detect", json={})
        assert resp.status_code == 422

    def test_missing_shift_date_returns_422(self):
        bad = {"earnings": [{"platform": "Careem", "gross_earned": 2000,
                              "platform_deductions": 400, "net_received": 1600,
                              "hours_worked": 6}]}
        resp = client.post("/api/anomaly/detect", json=bad)
        assert resp.status_code == 422

    def test_missing_platform_returns_422(self):
        bad = {"earnings": [{"shift_date": "2026-01-01", "gross_earned": 2000,
                              "platform_deductions": 400, "net_received": 1600,
                              "hours_worked": 6}]}
        resp = client.post("/api/anomaly/detect", json=bad)
        assert resp.status_code == 422

    def test_non_numeric_gross_returns_422(self):
        bad = {"earnings": [{"shift_date": "2026-01-01", "platform": "Careem",
                              "gross_earned": "not_a_number", "platform_deductions": 400,
                              "net_received": 1600, "hours_worked": 6}]}
        resp = client.post("/api/anomaly/detect", json=bad)
        assert resp.status_code == 422
