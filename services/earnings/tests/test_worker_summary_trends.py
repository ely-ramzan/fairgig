"""
TDD Phase A5 — Worker Summary + Trends

Tests for:
  GET /api/earnings/worker/:id/summary  — aggregate income stats + platform breakdown
  GET /api/earnings/worker/:id/trends   — weekly earnings, commission, city median
"""
import uuid
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user
from app.database import get_db
from tests.conftest import AUTH_HDR, db_override

# ── Constants ────────────────────────────────────────────────────────────────
WORKER_ID   = "00000000-0000-0000-0000-000000000001"
ADVOCATE_ID = "00000000-0000-0000-0000-000000000005"
OTHER_WID   = "00000000-0000-0000-0000-000000000099"

WORKER   = {"user_id": WORKER_ID,   "role": "worker",   "city_zone_id": None}
ADVOCATE = {"user_id": ADVOCATE_ID, "role": "advocate", "city_zone_id": None}
AUTH_HDR = {"Authorization": "Bearer fake-token"}


# ── Mock helpers ─────────────────────────────────────────────────────────────

def make_fetchone_result(values):
    """Result whose .fetchone() returns an indexable sequence."""
    r = MagicMock()
    r.fetchone.return_value = values
    return r


def make_fetchall_result(rows):
    """Result whose .fetchall() returns a list of mapping-able rows."""
    r = MagicMock()
    r.fetchall.return_value = rows
    return r


def make_mapping_row(**kwargs):
    """A row that supports dict(row._mapping)."""
    row = MagicMock()
    row._mapping = kwargs
    return row


class MockSession:
    def __init__(self, *execute_results):
        self._queue = list(execute_results)

    async def execute(self, _stmt, _params=None):
        if self._queue:
            return self._queue.pop(0)
        r = MagicMock()
        r.fetchone.return_value = [0, 0, 0, 0, 0, 0, 0]
        r.fetchall.return_value = []
        return r

    def add(self, obj): pass
    async def flush(self): pass
    async def commit(self): pass
    async def refresh(self, obj): pass


def make_client(user: dict, session: MockSession):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = db_override(session)
    return TestClient(app)


# ── Sample aggregate row: [gross, deductions, net, hours, count, verified, commission_rate]
SUMMARY_ROW = [125000.0, 27500.0, 97500.0, 300.0, 50, 40, 22.0]

PLATFORM_ROWS = [
    make_mapping_row(platform="Careem", shifts=30, net=60000.0, commission_pct=22.0),
    make_mapping_row(platform="InDrive", shifts=20, net=37500.0, commission_pct=21.5),
]

EARNINGS_ROWS = [
    make_mapping_row(week="2026-01-05", net_income=8000.0, avg_hourly=266.67),
    make_mapping_row(week="2026-01-12", net_income=9500.0, avg_hourly=285.0),
]

COMMISSION_ROWS = [
    make_mapping_row(week="2026-01-05", platform_name="Careem", commission_rate=22.0),
]

MEDIAN_ROWS = [
    make_mapping_row(week="2026-01-05", platform_name="Careem",
                     city_median=7500.0, p25_net=6000.0, p75_net=9000.0),
]


# ── TestWorkerSummary ─────────────────────────────────────────────────────────

class TestWorkerSummary:
    def _get(self, worker_id: str = WORKER_ID, user: dict = None,
             summary_row=None, platform_rows=None):
        session = MockSession(
            make_fetchone_result(summary_row or SUMMARY_ROW),
            make_fetchall_result(platform_rows or PLATFORM_ROWS),
        )
        client = make_client(user or WORKER, session)
        return client.get(
            f"/api/earnings/worker/{worker_id}/summary",
            headers=AUTH_HDR,
        )

    def test_returns_200_for_own_summary(self):
        assert self._get().status_code == 200

    def test_response_has_total_gross(self):
        assert "total_gross" in self._get().json()

    def test_response_has_total_deductions(self):
        assert "total_deductions" in self._get().json()

    def test_response_has_total_net(self):
        assert "total_net" in self._get().json()

    def test_response_has_total_hours(self):
        assert "total_hours" in self._get().json()

    def test_response_has_shift_count(self):
        assert "shift_count" in self._get().json()

    def test_response_has_verified_count(self):
        assert "verified_count" in self._get().json()

    def test_response_has_avg_commission_rate(self):
        assert "avg_commission_rate" in self._get().json()

    def test_response_has_platform_breakdown(self):
        assert "platform_breakdown" in self._get().json()

    def test_platform_breakdown_is_list(self):
        assert isinstance(self._get().json()["platform_breakdown"], list)

    def test_total_gross_value_correct(self):
        assert self._get().json()["total_gross"] == 125000.0

    def test_shift_count_value_correct(self):
        assert self._get().json()["shift_count"] == 50

    def test_verified_count_value_correct(self):
        assert self._get().json()["verified_count"] == 40

    def test_platform_breakdown_has_two_entries(self):
        assert len(self._get().json()["platform_breakdown"]) == 2

    def test_worker_cannot_see_other_worker_summary(self):
        resp = self._get(worker_id=OTHER_WID, user=WORKER)
        assert resp.status_code == 403

    def test_advocate_can_see_any_worker_summary(self):
        resp = self._get(worker_id=OTHER_WID, user=ADVOCATE)
        assert resp.status_code == 200

    def test_zero_shifts_returns_zeroes(self):
        resp = self._get(summary_row=[None, None, None, None, None, None, None],
                         platform_rows=[])
        body = resp.json()
        assert body["total_gross"] == 0.0 and body["shift_count"] == 0

    def test_date_from_filter_accepted(self):
        session = MockSession(
            make_fetchone_result(SUMMARY_ROW),
            make_fetchall_result(PLATFORM_ROWS),
        )
        client = make_client(WORKER, session)
        resp = client.get(
            f"/api/earnings/worker/{WORKER_ID}/summary?date_from=2026-01-01",
            headers=AUTH_HDR,
        )
        assert resp.status_code == 200

    def test_date_to_filter_accepted(self):
        session = MockSession(
            make_fetchone_result(SUMMARY_ROW),
            make_fetchall_result(PLATFORM_ROWS),
        )
        client = make_client(WORKER, session)
        resp = client.get(
            f"/api/earnings/worker/{WORKER_ID}/summary?date_to=2026-03-31",
            headers=AUTH_HDR,
        )
        assert resp.status_code == 200

    def test_requires_auth(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/earnings/worker/{WORKER_ID}/summary")
        assert resp.status_code in (401, 403)


# ── TestWorkerTrends ──────────────────────────────────────────────────────────

class TestWorkerTrends:
    def _get(self, worker_id: str = WORKER_ID, user: dict = None,
             months: int = None,
             earnings_rows=None, commission_rows=None, median_rows=None):
        session = MockSession(
            make_fetchall_result(EARNINGS_ROWS if earnings_rows is None else earnings_rows),
            make_fetchall_result(COMMISSION_ROWS if commission_rows is None else commission_rows),
            make_fetchall_result(MEDIAN_ROWS if median_rows is None else median_rows),
        )
        client = make_client(user or WORKER, session)
        url = f"/api/earnings/worker/{worker_id}/trends"
        if months is not None:
            url += f"?months={months}"
        return client.get(url, headers=AUTH_HDR)

    def test_returns_200_for_own_trends(self):
        assert self._get().status_code == 200

    def test_response_has_earnings_trend(self):
        assert "earnings_trend" in self._get().json()

    def test_response_has_commission_trend(self):
        assert "commission_trend" in self._get().json()

    def test_response_has_city_median_comparison(self):
        assert "city_median_comparison" in self._get().json()

    def test_earnings_trend_is_list(self):
        assert isinstance(self._get().json()["earnings_trend"], list)

    def test_commission_trend_is_list(self):
        assert isinstance(self._get().json()["commission_trend"], list)

    def test_city_median_comparison_is_list(self):
        assert isinstance(self._get().json()["city_median_comparison"], list)

    def test_earnings_trend_has_two_weeks(self):
        assert len(self._get().json()["earnings_trend"]) == 2

    def test_worker_cannot_see_other_worker_trends(self):
        resp = self._get(worker_id=OTHER_WID, user=WORKER)
        assert resp.status_code == 403

    def test_advocate_can_see_any_worker_trends(self):
        resp = self._get(worker_id=OTHER_WID, user=ADVOCATE)
        assert resp.status_code == 200

    def test_months_param_accepted(self):
        assert self._get(months=6).status_code == 200

    def test_months_out_of_range_returns_422(self):
        session = MockSession()
        client = make_client(WORKER, session)
        resp = client.get(
            f"/api/earnings/worker/{WORKER_ID}/trends?months=99",
            headers=AUTH_HDR,
        )
        assert resp.status_code == 422

    def test_empty_data_returns_empty_lists(self):
        resp = self._get(earnings_rows=[], commission_rows=[], median_rows=[])
        body = resp.json()
        assert body["earnings_trend"] == []
        assert body["commission_trend"] == []
        assert body["city_median_comparison"] == []

    def test_requires_auth(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get(f"/api/earnings/worker/{WORKER_ID}/trends")
        assert resp.status_code in (401, 403)
