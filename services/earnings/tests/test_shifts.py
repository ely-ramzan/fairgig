"""
TDD Phase A2 — Earnings Service: Shift CRUD

Tests for:
  POST   /api/earnings/shifts                    — create shift (worker only, math validation)
  GET    /api/earnings/shifts                    — paginated list (authenticated)
  GET    /api/earnings/shifts/:id                — single shift with access control
  GET    /api/earnings/platforms                 — platform list (authenticated)
  GET    /api/earnings/worker/:id/shifts-raw     — flat list for Anomaly Service
"""
import uuid
import pytest
from datetime import date
from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from app.main import app
from app.dependencies import get_current_user
from app.database import get_db

# ── Constants ────────────────────────────────────────────────────────────────
WORKER_ID   = "00000000-0000-0000-0000-000000000001"
PLATFORM_ID = "00000000-0000-0000-0000-000000000002"
SHIFT_ID    = "00000000-0000-0000-0000-000000000003"
OTHER_WID   = "00000000-0000-0000-0000-000000000099"

WORKER   = {"user_id": WORKER_ID, "role": "worker",   "city_zone_id": None}
ADVOCATE = {"user_id": "aa-0001", "role": "advocate", "city_zone_id": None}
VERIFIER = {"user_id": "vv-0001", "role": "verifier", "city_zone_id": None}
AUTH_HDR = {"Authorization": "Bearer fake-token"}

VALID_SHIFT = {
    "platform_id":          PLATFORM_ID,
    "shift_date":           "2026-01-15",
    "hours_worked":         6.0,
    "gross_earned":      2500.0,
    "platform_deductions": 550.0,
    "net_received":       1950.0,   # exact: 2500 - 550
}


# ── Mock DB helpers ───────────────────────────────────────────────────────────
class MockSession:
    """Returns execute results in FIFO order; add/commit/refresh are no-ops."""

    def __init__(self, *execute_results):
        self._queue = list(execute_results)
        self._idx = 0
        self.added = []

    async def execute(self, _stmt):
        if self._idx < len(self._queue):
            r = self._queue[self._idx]
            self._idx += 1
            return r
        return MagicMock()

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        pass

    async def refresh(self, _obj):
        pass


def make_scalar(value):
    r = MagicMock()
    r.scalar.return_value = value
    return r


def make_scalars_all(items):
    scalars = MagicMock()
    scalars.all.return_value = items
    r = MagicMock()
    r.scalars.return_value = scalars
    return r


def make_scalar_one_or_none(item):
    r = MagicMock()
    r.scalar_one_or_none.return_value = item
    return r


def make_all(items):
    r = MagicMock()
    r.all.return_value = items
    return r


def make_mock_shift(worker_id=WORKER_ID, shift_id=SHIFT_ID):
    s = MagicMock()
    s.id = uuid.UUID(shift_id)
    s.worker_id = uuid.UUID(worker_id)
    s.platform_id = uuid.UUID(PLATFORM_ID)
    s.shift_date = date(2026, 1, 15)
    s.hours_worked = 6.0
    s.gross_earned = 2500.0
    s.platform_deductions = 550.0
    s.net_received = 1950.0
    s.verification_status = "pending"
    s.import_source = "manual"
    s.created_at = None
    return s


def make_mock_platform():
    p = MagicMock()
    p.id = uuid.uuid4()
    p.name = "Careem"
    p.category = "ride"
    return p


# ── Client factory ────────────────────────────────────────────────────────────
def db_override(session):
    async def _():
        yield session
    return _


def make_client(user, *execute_results):
    session = MockSession(*execute_results)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = db_override(session)
    return TestClient(app), session


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


# ── Tests: POST /api/earnings/shifts ─────────────────────────────────────────
class TestCreateShift:
    def test_returns_201_on_success(self):
        client, _ = make_client(WORKER)
        resp = client.post("/api/earnings/shifts", json=VALID_SHIFT, headers=AUTH_HDR)
        assert resp.status_code == 201

    def test_no_auth_returns_401_or_403(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post("/api/earnings/shifts", json=VALID_SHIFT)
        assert resp.status_code in (401, 403)

    def test_advocate_cannot_create_shift(self):
        client, _ = make_client(ADVOCATE)
        resp = client.post("/api/earnings/shifts", json=VALID_SHIFT, headers=AUTH_HDR)
        assert resp.status_code == 403

    def test_verifier_cannot_create_shift(self):
        client, _ = make_client(VERIFIER)
        resp = client.post("/api/earnings/shifts", json=VALID_SHIFT, headers=AUTH_HDR)
        assert resp.status_code == 403

    def test_response_has_id(self):
        client, _ = make_client(WORKER)
        resp = client.post("/api/earnings/shifts", json=VALID_SHIFT, headers=AUTH_HDR)
        assert "id" in resp.json()

    def test_response_has_worker_id(self):
        client, _ = make_client(WORKER)
        resp = client.post("/api/earnings/shifts", json=VALID_SHIFT, headers=AUTH_HDR)
        assert "worker_id" in resp.json()

    def test_response_worker_id_matches_auth_user(self):
        client, _ = make_client(WORKER)
        resp = client.post("/api/earnings/shifts", json=VALID_SHIFT, headers=AUTH_HDR)
        assert resp.json()["worker_id"] == WORKER_ID

    def test_verification_status_defaults_to_pending(self):
        client, _ = make_client(WORKER)
        resp = client.post("/api/earnings/shifts", json=VALID_SHIFT, headers=AUTH_HDR)
        assert resp.json()["verification_status"] == "pending"

    def test_import_source_is_manual(self):
        client, _ = make_client(WORKER)
        resp = client.post("/api/earnings/shifts", json=VALID_SHIFT, headers=AUTH_HDR)
        assert resp.json()["import_source"] == "manual"

    def test_math_validation_rejects_wrong_net(self):
        client, _ = make_client(WORKER)
        bad = {**VALID_SHIFT, "net_received": 1000.0}   # 950 off — way outside 2%
        resp = client.post("/api/earnings/shifts", json=bad, headers=AUTH_HDR)
        assert resp.status_code == 422

    def test_math_validation_allows_within_2_percent(self):
        client, _ = make_client(WORKER)
        # tolerance = 1950 * 0.02 = 39; 1960 is only 10 off → valid
        ok = {**VALID_SHIFT, "net_received": 1960.0}
        resp = client.post("/api/earnings/shifts", json=ok, headers=AUTH_HDR)
        assert resp.status_code == 201

    def test_missing_platform_id_returns_422(self):
        client, _ = make_client(WORKER)
        bad = {k: v for k, v in VALID_SHIFT.items() if k != "platform_id"}
        assert client.post("/api/earnings/shifts", json=bad, headers=AUTH_HDR).status_code == 422

    def test_missing_shift_date_returns_422(self):
        client, _ = make_client(WORKER)
        bad = {k: v for k, v in VALID_SHIFT.items() if k != "shift_date"}
        assert client.post("/api/earnings/shifts", json=bad, headers=AUTH_HDR).status_code == 422

    def test_missing_gross_earned_returns_422(self):
        client, _ = make_client(WORKER)
        bad = {k: v for k, v in VALID_SHIFT.items() if k != "gross_earned"}
        assert client.post("/api/earnings/shifts", json=bad, headers=AUTH_HDR).status_code == 422


# ── Tests: GET /api/earnings/shifts ──────────────────────────────────────────
class TestListShifts:
    def _client(self, count=1, shifts=None):
        if shifts is None:
            shifts = [make_mock_shift()]
        count_r = make_scalar(count)
        list_r  = make_scalars_all(shifts)
        return make_client(WORKER, count_r, list_r)

    def test_returns_200(self):
        client, _ = self._client()
        assert client.get("/api/earnings/shifts", headers=AUTH_HDR).status_code == 200

    def test_no_auth_returns_401_or_403(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        assert client.get("/api/earnings/shifts").status_code in (401, 403)

    def test_response_has_items_key(self):
        client, _ = self._client()
        assert "items" in client.get("/api/earnings/shifts", headers=AUTH_HDR).json()

    def test_response_has_total_key(self):
        client, _ = self._client()
        assert "total" in client.get("/api/earnings/shifts", headers=AUTH_HDR).json()

    def test_response_has_page_key(self):
        client, _ = self._client()
        assert "page" in client.get("/api/earnings/shifts", headers=AUTH_HDR).json()

    def test_response_has_limit_key(self):
        client, _ = self._client()
        assert "limit" in client.get("/api/earnings/shifts", headers=AUTH_HDR).json()

    def test_response_has_total_pages_key(self):
        client, _ = self._client()
        assert "total_pages" in client.get("/api/earnings/shifts", headers=AUTH_HDR).json()

    def test_items_is_a_list(self):
        client, _ = self._client()
        data = client.get("/api/earnings/shifts", headers=AUTH_HDR).json()
        assert isinstance(data["items"], list)

    def test_total_reflects_count(self):
        client, _ = self._client(count=1)
        data = client.get("/api/earnings/shifts", headers=AUTH_HDR).json()
        assert data["total"] == 1

    def test_page_defaults_to_1(self):
        client, _ = self._client()
        data = client.get("/api/earnings/shifts", headers=AUTH_HDR).json()
        assert data["page"] == 1

    def test_limit_defaults_to_20(self):
        client, _ = self._client()
        data = client.get("/api/earnings/shifts", headers=AUTH_HDR).json()
        assert data["limit"] == 20

    def test_total_pages_calculated_correctly(self):
        # 25 items, limit=10 → ceil(25/10) = 3 pages
        client, _ = self._client(count=25, shifts=[make_mock_shift()] * 10)
        data = client.get("/api/earnings/shifts?limit=10", headers=AUTH_HDR).json()
        assert data["total_pages"] == 3

    def test_empty_shifts_returns_empty_items_and_zero_total(self):
        client, _ = self._client(count=0, shifts=[])
        data = client.get("/api/earnings/shifts", headers=AUTH_HDR).json()
        assert data["items"] == []
        assert data["total"] == 0


# ── Tests: GET /api/earnings/shifts/:id ──────────────────────────────────────
class TestGetShiftById:
    URL = f"/api/earnings/shifts/{SHIFT_ID}"

    def test_returns_200_for_own_shift(self):
        result = make_scalar_one_or_none(make_mock_shift(WORKER_ID))
        client, _ = make_client(WORKER, result)
        assert client.get(self.URL, headers=AUTH_HDR).status_code == 200

    def test_returns_404_for_nonexistent_shift(self):
        result = make_scalar_one_or_none(None)
        client, _ = make_client(WORKER, result)
        assert client.get(self.URL, headers=AUTH_HDR).status_code == 404

    def test_worker_cannot_see_other_workers_shift(self):
        result = make_scalar_one_or_none(make_mock_shift(worker_id=OTHER_WID))
        client, _ = make_client(WORKER, result)
        assert client.get(self.URL, headers=AUTH_HDR).status_code == 403

    def test_advocate_can_see_any_shift(self):
        result = make_scalar_one_or_none(make_mock_shift(WORKER_ID))
        client, _ = make_client(ADVOCATE, result)
        assert client.get(self.URL, headers=AUTH_HDR).status_code == 200

    def test_verifier_can_see_any_shift(self):
        result = make_scalar_one_or_none(make_mock_shift(WORKER_ID))
        client, _ = make_client(VERIFIER, result)
        assert client.get(self.URL, headers=AUTH_HDR).status_code == 200

    def test_no_auth_returns_401_or_403(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        assert client.get(self.URL).status_code in (401, 403)

    def test_response_has_id(self):
        result = make_scalar_one_or_none(make_mock_shift(WORKER_ID))
        client, _ = make_client(WORKER, result)
        assert "id" in client.get(self.URL, headers=AUTH_HDR).json()

    def test_response_has_verification_status(self):
        result = make_scalar_one_or_none(make_mock_shift(WORKER_ID))
        client, _ = make_client(WORKER, result)
        assert "verification_status" in client.get(self.URL, headers=AUTH_HDR).json()


# ── Tests: GET /api/earnings/platforms ───────────────────────────────────────
class TestListPlatforms:
    def test_returns_200(self):
        result = make_scalars_all([make_mock_platform()])
        client, _ = make_client(WORKER, result)
        assert client.get("/api/earnings/platforms", headers=AUTH_HDR).status_code == 200

    def test_returns_a_list(self):
        result = make_scalars_all([make_mock_platform()])
        client, _ = make_client(WORKER, result)
        data = client.get("/api/earnings/platforms", headers=AUTH_HDR).json()
        assert isinstance(data, list)

    def test_no_auth_returns_401_or_403(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        assert client.get("/api/earnings/platforms").status_code in (401, 403)

    def test_each_platform_has_name(self):
        result = make_scalars_all([make_mock_platform()])
        client, _ = make_client(WORKER, result)
        data = client.get("/api/earnings/platforms", headers=AUTH_HDR).json()
        assert len(data) > 0 and "name" in data[0]


# ── Tests: GET /api/earnings/worker/:id/shifts-raw ───────────────────────────
class TestWorkerShiftsRaw:
    URL = f"/api/earnings/worker/{WORKER_ID}/shifts-raw"

    def _client(self, rows=None):
        if rows is None:
            rows = [(make_mock_shift(), "Careem")]
        return make_client(WORKER, make_all(rows))

    def test_returns_200(self):
        client, _ = self._client()
        assert client.get(self.URL, headers=AUTH_HDR).status_code == 200

    def test_returns_a_list(self):
        client, _ = self._client()
        assert isinstance(client.get(self.URL, headers=AUTH_HDR).json(), list)

    def test_no_auth_returns_401_or_403(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        assert client.get(self.URL).status_code in (401, 403)

    def test_each_item_has_shift_date(self):
        client, _ = self._client()
        assert "shift_date" in client.get(self.URL, headers=AUTH_HDR).json()[0]

    def test_each_item_has_platform(self):
        client, _ = self._client()
        assert "platform" in client.get(self.URL, headers=AUTH_HDR).json()[0]

    def test_platform_value_is_platform_name_string(self):
        client, _ = self._client()
        assert client.get(self.URL, headers=AUTH_HDR).json()[0]["platform"] == "Careem"

    def test_each_item_has_gross_earned(self):
        client, _ = self._client()
        assert "gross_earned" in client.get(self.URL, headers=AUTH_HDR).json()[0]

    def test_each_item_has_platform_deductions(self):
        client, _ = self._client()
        assert "platform_deductions" in client.get(self.URL, headers=AUTH_HDR).json()[0]

    def test_each_item_has_net_received(self):
        client, _ = self._client()
        assert "net_received" in client.get(self.URL, headers=AUTH_HDR).json()[0]

    def test_each_item_has_hours_worked(self):
        client, _ = self._client()
        assert "hours_worked" in client.get(self.URL, headers=AUTH_HDR).json()[0]

    def test_empty_list_when_no_shifts(self):
        client, _ = self._client(rows=[])
        assert client.get(self.URL, headers=AUTH_HDR).json() == []
