"""
TDD — Phase H2.2: POST /api/anomaly/analyze-worker
Fetches worker earnings from Earnings Service, runs detection engine,
caches anomalies to DB, returns results.
"""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user
from app.database import get_db

WORKER_ID = "00000000-0000-0000-0000-000000000001"
WORKER_USER = {"user_id": WORKER_ID, "role": "worker", "city_zone_id": None}

# 7-entry spike: 6 normal at 22% + 1 at 30% → Z-score detects unusual_deduction
SPIKE_EARNINGS = [
    {
        "shift_date": f"2026-01-0{i}",
        "platform": "Careem",
        "gross_earned": 2500.0,
        "platform_deductions": 550.0,
        "net_received": 1950.0,
        "hours_worked": 6.0,
    }
    for i in range(1, 7)
] + [
    {
        "shift_date": "2026-01-07",
        "platform": "Careem",
        "gross_earned": 2500.0,
        "platform_deductions": 750.0,
        "net_received": 1750.0,
        "hours_worked": 6.0,
    }
]


class MockSession:
    def __init__(self):
        self.added = []

    async def execute(self, stmt):
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        return result

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        pass


def make_db_override(session):
    async def _override():
        yield session

    return _override


def make_earnings_mock(status_code, data):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = data
    return resp


@pytest.fixture
def worker_session():
    return MockSession()


@pytest.fixture
def worker_client(worker_session):
    app.dependency_overrides[get_current_user] = lambda: WORKER_USER
    app.dependency_overrides[get_db] = make_db_override(worker_session)
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()


@pytest.fixture
def bare_client():
    app.dependency_overrides.clear()
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()


def post_with_earnings(client, earnings):
    mock_resp = make_earnings_mock(200, earnings)
    with patch("httpx.AsyncClient") as mock_cls:
        mock_cls.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_resp)
        return client.post(
            "/api/anomaly/analyze-worker",
            headers={"Authorization": "Bearer fake-token"},
        )


class TestRequiresAuth:
    def test_no_auth_header_is_rejected(self, bare_client):
        resp = bare_client.post("/api/anomaly/analyze-worker")
        assert resp.status_code in (401, 403)


class TestEarningsServiceFailure:
    def test_returns_502_when_earnings_service_returns_503(self, worker_client):
        mock_resp = make_earnings_mock(503, {})
        with patch("httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_resp)
            resp = worker_client.post(
                "/api/anomaly/analyze-worker",
                headers={"Authorization": "Bearer fake-token"},
            )
        assert resp.status_code == 502

    def test_returns_502_when_earnings_service_returns_404(self, worker_client):
        mock_resp = make_earnings_mock(404, {})
        with patch("httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_resp)
            resp = worker_client.post(
                "/api/anomaly/analyze-worker",
                headers={"Authorization": "Bearer fake-token"},
            )
        assert resp.status_code == 502


class TestSuccessfulDetection:
    def test_returns_200_with_spike_data(self, worker_client):
        resp = post_with_earnings(worker_client, SPIKE_EARNINGS)
        assert resp.status_code == 200

    def test_response_has_anomalies_cached_key(self, worker_client):
        resp = post_with_earnings(worker_client, SPIKE_EARNINGS)
        assert "anomalies_cached" in resp.json()

    def test_response_has_anomalies_list_key(self, worker_client):
        resp = post_with_earnings(worker_client, SPIKE_EARNINGS)
        data = resp.json()
        assert "anomalies" in data
        assert isinstance(data["anomalies"], list)

    def test_spike_data_detects_at_least_one_anomaly(self, worker_client):
        resp = post_with_earnings(worker_client, SPIKE_EARNINGS)
        assert resp.json()["anomalies_cached"] > 0

    def test_anomalies_cached_count_matches_list_length(self, worker_client):
        resp = post_with_earnings(worker_client, SPIKE_EARNINGS)
        data = resp.json()
        assert data["anomalies_cached"] == len(data["anomalies"])

    def test_empty_earnings_returns_zero_cached(self, worker_client):
        resp = post_with_earnings(worker_client, [])
        assert resp.json()["anomalies_cached"] == 0

    def test_spike_data_saves_anomaly_records_to_db(self, worker_client, worker_session):
        post_with_earnings(worker_client, SPIKE_EARNINGS)
        assert len(worker_session.added) > 0

    def test_empty_earnings_saves_nothing_to_db(self, worker_client, worker_session):
        post_with_earnings(worker_client, [])
        assert len(worker_session.added) == 0

    def test_saved_record_has_anomaly_type(self, worker_client, worker_session):
        post_with_earnings(worker_client, SPIKE_EARNINGS)
        first = worker_session.added[0]
        assert hasattr(first, "anomaly_type")

    def test_saved_record_has_severity(self, worker_client, worker_session):
        post_with_earnings(worker_client, SPIKE_EARNINGS)
        first = worker_session.added[0]
        assert hasattr(first, "severity")

    def test_saved_record_has_explanation(self, worker_client, worker_session):
        post_with_earnings(worker_client, SPIKE_EARNINGS)
        first = worker_session.added[0]
        assert hasattr(first, "explanation")
