"""
TDD — Phase H2.3: GET /api/anomaly/results/{worker_id}
Returns cached anomaly results from DB with optional severity filter.
"""
import uuid
import pytest
from datetime import datetime
from decimal import Decimal
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user
from app.database import get_db

WORKER_ID = "00000000-0000-0000-0000-000000000001"
WORKER_USER = {"user_id": WORKER_ID, "role": "worker", "city_zone_id": None}
ADVOCATE_USER = {
    "user_id": "00000000-0000-0000-0000-000000000002",
    "role": "advocate",
    "city_zone_id": None,
}

RESULTS_URL = f"/api/anomaly/results/{WORKER_ID}"


def make_anomaly_row(anomaly_type="unusual_deduction", severity="medium"):
    obj = MagicMock()
    obj.id = uuid.uuid4()
    obj.worker_id = uuid.UUID(WORKER_ID)
    obj.anomaly_type = anomaly_type
    obj.severity = severity
    obj.metric_name = "commission_rate"
    obj.expected_low = Decimal("18.00")
    obj.expected_high = Decimal("26.00")
    obj.actual_value = Decimal("30.00")
    obj.deviation_score = Decimal("2.27")
    obj.explanation = "Your commission rate was outside the normal range."
    obj.detected_at = datetime(2026, 1, 7, 12, 0, 0)
    return obj


class MockSession:
    def __init__(self, results=None):
        self._results = results or []

    async def execute(self, stmt):
        result = MagicMock()
        result.scalars.return_value.all.return_value = self._results
        return result

    def add(self, obj):
        pass

    async def commit(self):
        pass


def make_db_override(session):
    async def _override():
        yield session

    return _override


def setup_client(user, db_results=None):
    session = MockSession(db_results or [])
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = make_db_override(session)
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


AUTH_HEADER = {"Authorization": "Bearer fake-token"}


class TestRequiresAuth:
    def test_no_auth_header_is_rejected(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(RESULTS_URL)
        assert resp.status_code in (401, 403)


class TestEmptyResults:
    def test_returns_200_with_no_stored_anomalies(self):
        client = setup_client(WORKER_USER, [])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert resp.status_code == 200

    def test_empty_db_returns_empty_list(self):
        client = setup_client(WORKER_USER, [])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert resp.json() == []


class TestResultFields:
    def test_returns_list_when_anomalies_exist(self):
        client = setup_client(WORKER_USER, [make_anomaly_row()])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert len(resp.json()) == 1

    def test_each_result_has_anomaly_type(self):
        client = setup_client(WORKER_USER, [make_anomaly_row()])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert "anomaly_type" in resp.json()[0]

    def test_each_result_has_severity(self):
        client = setup_client(WORKER_USER, [make_anomaly_row()])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert "severity" in resp.json()[0]

    def test_each_result_has_explanation(self):
        client = setup_client(WORKER_USER, [make_anomaly_row()])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert "explanation" in resp.json()[0]

    def test_each_result_has_expected_low(self):
        client = setup_client(WORKER_USER, [make_anomaly_row()])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert "expected_low" in resp.json()[0]

    def test_each_result_has_detected_at(self):
        client = setup_client(WORKER_USER, [make_anomaly_row()])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert "detected_at" in resp.json()[0]

    def test_anomaly_type_value_matches_stored(self):
        client = setup_client(WORKER_USER, [make_anomaly_row(anomaly_type="mom_drop")])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert resp.json()[0]["anomaly_type"] == "mom_drop"

    def test_severity_value_matches_stored(self):
        client = setup_client(WORKER_USER, [make_anomaly_row(severity="high")])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert resp.json()[0]["severity"] == "high"

    def test_explanation_value_matches_stored(self):
        client = setup_client(WORKER_USER, [make_anomaly_row()])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert "normal range" in resp.json()[0]["explanation"]


class TestSeverityFilter:
    def test_severity_query_param_accepted(self):
        client = setup_client(WORKER_USER, [])
        resp = client.get(f"{RESULTS_URL}?severity=high", headers=AUTH_HEADER)
        assert resp.status_code == 200

    def test_all_three_severity_values_accepted(self):
        for sev in ("low", "medium", "high"):
            client = setup_client(WORKER_USER, [])
            resp = client.get(f"{RESULTS_URL}?severity={sev}", headers=AUTH_HEADER)
            assert resp.status_code == 200, f"severity={sev} should be accepted"


class TestAccessControl:
    def test_advocate_can_view_any_worker_results(self):
        client = setup_client(ADVOCATE_USER, [make_anomaly_row()])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert resp.status_code == 200

    def test_worker_can_view_results(self):
        client = setup_client(WORKER_USER, [make_anomaly_row()])
        resp = client.get(RESULTS_URL, headers=AUTH_HEADER)
        assert resp.status_code == 200
