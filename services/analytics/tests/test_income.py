"""TDD — H5.3: GET /api/analytics/income-distribution (advocate only)"""
import pytest
from app.main import app
from app.database import get_db
from .conftest import MockRow, make_list_session, db_override, AUTH_HDR

SAMPLE_ROW = MockRow(
    zone_name="DHA",
    platform_name="Careem",
    p25_net=1400.00,
    p50_net=1800.00,
    p75_net=2200.00,
    avg_net=1850.00,
    worker_count=35,
)


class TestAuth:
    def test_no_auth_returns_403(self, bare_client):
        resp = bare_client.get("/api/analytics/income-distribution")
        assert resp.status_code in (401, 403)

    def test_worker_role_returns_403(self, worker_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([]))
        resp = worker_client.get("/api/analytics/income-distribution", headers=AUTH_HDR)
        assert resp.status_code == 403

    def test_advocate_gets_200(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([]))
        resp = advocate_client.get("/api/analytics/income-distribution", headers=AUTH_HDR)
        assert resp.status_code == 200


class TestResponseShape:
    def test_response_is_a_list(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/income-distribution", headers=AUTH_HDR)
        assert isinstance(resp.json(), list)

    def test_item_has_zone_name(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/income-distribution", headers=AUTH_HDR)
        assert "zone_name" in resp.json()[0]

    def test_item_has_p25_net(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/income-distribution", headers=AUTH_HDR)
        assert "p25_net" in resp.json()[0]

    def test_item_has_p50_net(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/income-distribution", headers=AUTH_HDR)
        assert "p50_net" in resp.json()[0]

    def test_item_has_p75_net(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/income-distribution", headers=AUTH_HDR)
        assert "p75_net" in resp.json()[0]

    def test_item_has_avg_net(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/income-distribution", headers=AUTH_HDR)
        assert "avg_net" in resp.json()[0]

    def test_item_has_worker_count(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/income-distribution", headers=AUTH_HDR)
        assert "worker_count" in resp.json()[0]
