"""TDD — H5.2: GET /api/analytics/commission-trends (advocate only)"""
import pytest
from app.main import app
from app.database import get_db
from .conftest import MockRow, make_list_session, db_override, AUTH_HDR

SAMPLE_ROW = MockRow(
    platform_name="Careem",
    week="2026-01-07",
    avg_commission_rate=22.5,
    worker_count=120,
    total_shifts=480,
)


class TestAuth:
    def test_no_auth_returns_403(self, bare_client):
        resp = bare_client.get("/api/analytics/commission-trends")
        assert resp.status_code in (401, 403)

    def test_worker_role_returns_403(self, worker_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([]))
        resp = worker_client.get("/api/analytics/commission-trends", headers=AUTH_HDR)
        assert resp.status_code == 403

    def test_advocate_gets_200(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([]))
        resp = advocate_client.get("/api/analytics/commission-trends", headers=AUTH_HDR)
        assert resp.status_code == 200


class TestResponseShape:
    def test_response_is_a_list(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/commission-trends", headers=AUTH_HDR)
        assert isinstance(resp.json(), list)

    def test_empty_db_returns_empty_list(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([]))
        resp = advocate_client.get("/api/analytics/commission-trends", headers=AUTH_HDR)
        assert resp.json() == []

    def test_item_has_platform_name(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/commission-trends", headers=AUTH_HDR)
        assert "platform_name" in resp.json()[0]

    def test_item_has_avg_commission_rate(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/commission-trends", headers=AUTH_HDR)
        assert "avg_commission_rate" in resp.json()[0]

    def test_item_has_worker_count(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/commission-trends", headers=AUTH_HDR)
        assert "worker_count" in resp.json()[0]

    def test_item_has_total_shifts(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([SAMPLE_ROW]))
        resp = advocate_client.get("/api/analytics/commission-trends", headers=AUTH_HDR)
        assert "total_shifts" in resp.json()[0]


class TestQueryParams:
    def test_default_months_accepted(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([]))
        resp = advocate_client.get("/api/analytics/commission-trends", headers=AUTH_HDR)
        assert resp.status_code == 200

    def test_months_6_accepted(self, advocate_client):
        app.dependency_overrides[get_db] = db_override(make_list_session([]))
        resp = advocate_client.get("/api/analytics/commission-trends?months=6", headers=AUTH_HDR)
        assert resp.status_code == 200

    def test_months_0_rejected(self, advocate_client):
        resp = advocate_client.get("/api/analytics/commission-trends?months=0", headers=AUTH_HDR)
        assert resp.status_code == 422

    def test_months_13_rejected(self, advocate_client):
        resp = advocate_client.get("/api/analytics/commission-trends?months=13", headers=AUTH_HDR)
        assert resp.status_code == 422
