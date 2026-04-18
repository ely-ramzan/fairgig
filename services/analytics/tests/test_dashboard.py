"""TDD — H5.6: GET /api/analytics/dashboard-summary (advocate only)
Dashboard uses asyncio.gather() → 7 sequential DB execute() calls.
"""
import pytest
from app.main import app
from app.database import get_db
from .conftest import (
    make_sequence_session, make_scalar_result, make_fetchone_result,
    db_override, AUTH_HDR,
)


def make_dashboard_session():
    """Returns a session pre-loaded with the 7 results dashboard expects, in order."""
    return make_sequence_session(
        make_scalar_result(142),                       # active workers
        make_fetchone_result(8000, 6500, 120),         # total, verified, disputed shifts
        make_scalar_result(22.4),                      # avg commission
        make_scalar_result(5),                         # vulnerable workers
        make_scalar_result(18),                        # open grievances
        make_fetchone_result("commission_change"),     # top category
        make_scalar_result(3),                         # platform count
    )


class TestAuth:
    def test_no_auth_returns_403(self, bare_client):
        resp = bare_client.get("/api/analytics/dashboard-summary")
        assert resp.status_code in (401, 403)

    def test_worker_role_returns_403(self, worker_client):
        app.dependency_overrides[get_db] = db_override(make_dashboard_session())
        resp = worker_client.get("/api/analytics/dashboard-summary", headers=AUTH_HDR)
        assert resp.status_code == 403

    def test_advocate_gets_200(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_dashboard_session())
        resp = advocate_client.get("/api/analytics/dashboard-summary", headers=AUTH_HDR)
        assert resp.status_code == 200


class TestResponseKeys:
    def _get(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_dashboard_session())
        return advocate_client.get("/api/analytics/dashboard-summary", headers=AUTH_HDR)

    def test_has_total_active_workers(self, advocate_client):
        assert "total_active_workers" in self._get(advocate_client).json()

    def test_has_total_shifts_logged(self, advocate_client):
        assert "total_shifts_logged" in self._get(advocate_client).json()

    def test_has_total_verified(self, advocate_client):
        assert "total_verified" in self._get(advocate_client).json()

    def test_has_total_disputes(self, advocate_client):
        assert "total_disputes" in self._get(advocate_client).json()

    def test_has_avg_commission_rate(self, advocate_client):
        assert "avg_commission_rate" in self._get(advocate_client).json()

    def test_has_vulnerable_workers_count(self, advocate_client):
        assert "vulnerable_workers_count" in self._get(advocate_client).json()

    def test_has_open_grievances(self, advocate_client):
        assert "open_grievances" in self._get(advocate_client).json()

    def test_has_top_complaint_category(self, advocate_client):
        assert "top_complaint_category" in self._get(advocate_client).json()

    def test_has_platforms_tracked(self, advocate_client):
        assert "platforms_tracked" in self._get(advocate_client).json()


class TestResponseValues:
    def _get(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_dashboard_session())
        return advocate_client.get("/api/analytics/dashboard-summary", headers=AUTH_HDR).json()

    def test_total_active_workers_is_number(self, advocate_client):
        assert isinstance(self._get(advocate_client)["total_active_workers"], (int, float))

    def test_total_shifts_logged_is_number(self, advocate_client):
        assert isinstance(self._get(advocate_client)["total_shifts_logged"], (int, float))

    def test_avg_commission_rate_is_number(self, advocate_client):
        assert isinstance(self._get(advocate_client)["avg_commission_rate"], (int, float))

    def test_vulnerable_workers_count_is_number(self, advocate_client):
        assert isinstance(self._get(advocate_client)["vulnerable_workers_count"], (int, float))

    def test_total_active_workers_matches_mock(self, advocate_client):
        assert self._get(advocate_client)["total_active_workers"] == 142

    def test_platforms_tracked_matches_mock(self, advocate_client):
        assert self._get(advocate_client)["platforms_tracked"] == 3

    def test_top_category_matches_mock(self, advocate_client):
        assert self._get(advocate_client)["top_complaint_category"] == "commission_change"
