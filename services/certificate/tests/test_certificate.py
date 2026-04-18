"""
TDD Phase A6 — Certificate Renderer Service

Tests for:
  GET /health                        — service liveness
  CORS middleware                    — preflight + allow-origin
  GET /api/certificate/preview       — JSON cert context (requires auth + date range)
  GET /api/certificate/generate      — print-ready HTML (requires auth + date range)
"""
from unittest.mock import patch, AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user
from tests.conftest import AUTH_HDR, WORKER, WORKER_ID, MOCK_SUMMARY


DATE_PARAMS = "date_from=2026-01-01&date_to=2026-03-31"


def _mock_fetch(summary: dict = None):
    """Returns an async mock for _fetch_summary that returns the given summary."""
    async def _inner(*args, **kwargs):
        return summary or MOCK_SUMMARY
    return _inner


def _mock_fetch_error():
    """Returns an async mock for _fetch_summary that raises HTTPException 502."""
    from fastapi import HTTPException
    async def _inner(*args, **kwargs):
        raise HTTPException(502, "Could not fetch earnings summary from Earnings Service")
    return _inner


# ── TestHealthEndpoint ────────────────────────────────────────────────────────

class TestHealthEndpoint:
    def test_returns_200(self, bare_client):
        assert bare_client.get("/health").status_code == 200

    def test_status_is_ok(self, bare_client):
        assert bare_client.get("/health").json()["status"] == "ok"

    def test_service_is_certificate(self, bare_client):
        assert bare_client.get("/health").json()["service"] == "certificate"

    def test_openapi_title(self, bare_client):
        data = bare_client.get("/openapi.json").json()
        assert data["info"]["title"] == "FairGig Certificate Service"


# ── TestCORSMiddleware ────────────────────────────────────────────────────────

class TestCORSMiddleware:
    def test_preflight_returns_success(self, bare_client):
        resp = bare_client.options(
            "/api/certificate/preview",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code in (200, 204)

    def test_allow_origin_header_present(self, bare_client):
        resp = bare_client.get(
            "/health",
            headers={"Origin": "http://localhost:5173"},
        )
        assert resp.headers.get("access-control-allow-origin") == "http://localhost:5173"


# ── TestCertificatePreview ────────────────────────────────────────────────────

class TestCertificatePreview:
    def _get(self, client, params: str = DATE_PARAMS, summary: dict = None):
        with patch("app.routes.certificate._fetch_summary",
                   side_effect=_mock_fetch(summary)):
            return client.get(
                f"/api/certificate/preview?{params}",
                headers=AUTH_HDR,
            )

    def test_no_auth_returns_401_or_403(self, bare_client):
        resp = bare_client.get(f"/api/certificate/preview?{DATE_PARAMS}")
        assert resp.status_code in (401, 403)

    def test_missing_date_from_returns_422(self, auth_client):
        with patch("app.routes.certificate._fetch_summary",
                   side_effect=_mock_fetch()):
            resp = auth_client.get(
                "/api/certificate/preview?date_to=2026-03-31",
                headers=AUTH_HDR,
            )
        assert resp.status_code == 422

    def test_missing_date_to_returns_422(self, auth_client):
        with patch("app.routes.certificate._fetch_summary",
                   side_effect=_mock_fetch()):
            resp = auth_client.get(
                "/api/certificate/preview?date_from=2026-01-01",
                headers=AUTH_HDR,
            )
        assert resp.status_code == 422

    def test_valid_request_returns_200(self, auth_client):
        assert self._get(auth_client).status_code == 200

    def test_response_has_cert_id(self, auth_client):
        assert "cert_id" in self._get(auth_client).json()

    def test_response_has_generated_date(self, auth_client):
        assert "generated_date" in self._get(auth_client).json()

    def test_response_has_worker_name(self, auth_client):
        assert "worker_name" in self._get(auth_client).json()

    def test_response_has_total_gross(self, auth_client):
        assert "total_gross" in self._get(auth_client).json()

    def test_response_has_total_net(self, auth_client):
        assert "total_net" in self._get(auth_client).json()

    def test_response_has_total_hours(self, auth_client):
        assert "total_hours" in self._get(auth_client).json()

    def test_response_has_shift_count(self, auth_client):
        assert "shift_count" in self._get(auth_client).json()

    def test_response_has_verified_count(self, auth_client):
        assert "verified_count" in self._get(auth_client).json()

    def test_response_has_platform_breakdown(self, auth_client):
        assert "platform_breakdown" in self._get(auth_client).json()

    def test_response_has_hourly_rate(self, auth_client):
        assert "hourly_rate" in self._get(auth_client).json()

    def test_total_gross_formatted(self, auth_client):
        body = self._get(auth_client).json()
        assert body["total_gross"] == "125,000.00"

    def test_total_net_formatted(self, auth_client):
        body = self._get(auth_client).json()
        assert body["total_net"] == "97,500.00"

    def test_shift_count_value(self, auth_client):
        assert self._get(auth_client).json()["shift_count"] == 50

    def test_earnings_service_failure_returns_502(self, auth_client):
        with patch("app.routes.certificate._fetch_summary",
                   side_effect=_mock_fetch_error()):
            resp = auth_client.get(
                f"/api/certificate/preview?{DATE_PARAMS}",
                headers=AUTH_HDR,
            )
        assert resp.status_code == 502

    def test_date_range_reflected_in_response(self, auth_client):
        body = self._get(auth_client).json()
        assert body["date_from"] == "2026-01-01"
        assert body["date_to"] == "2026-03-31"


# ── TestCertificateGenerate ───────────────────────────────────────────────────

class TestCertificateGenerate:
    def _get(self, client, params: str = DATE_PARAMS, summary: dict = None):
        with patch("app.routes.certificate._fetch_summary",
                   side_effect=_mock_fetch(summary)):
            return client.get(
                f"/api/certificate/generate?{params}",
                headers=AUTH_HDR,
            )

    def test_no_auth_returns_401_or_403(self, bare_client):
        resp = bare_client.get(f"/api/certificate/generate?{DATE_PARAMS}")
        assert resp.status_code in (401, 403)

    def test_missing_date_from_returns_422(self, auth_client):
        with patch("app.routes.certificate._fetch_summary",
                   side_effect=_mock_fetch()):
            resp = auth_client.get(
                "/api/certificate/generate?date_to=2026-03-31",
                headers=AUTH_HDR,
            )
        assert resp.status_code == 422

    def test_valid_request_returns_200(self, auth_client):
        assert self._get(auth_client).status_code == 200

    def test_content_type_is_html(self, auth_client):
        resp = self._get(auth_client)
        assert "text/html" in resp.headers["content-type"]

    def test_html_contains_fairgig(self, auth_client):
        assert "FairGig" in self._get(auth_client).text

    def test_html_contains_total_net(self, auth_client):
        assert "97,500.00" in self._get(auth_client).text

    def test_html_contains_worker_name(self, auth_client):
        assert "Test Worker" in self._get(auth_client).text

    def test_html_contains_platform_name(self, auth_client):
        assert "Careem" in self._get(auth_client).text

    def test_html_contains_shift_count(self, auth_client):
        assert "50" in self._get(auth_client).text
