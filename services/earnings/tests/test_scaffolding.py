"""
TDD Phase A1 — Earnings Service Scaffolding

Tests the service bootstrap:
- /health endpoint
- App metadata (OpenAPI title/version)
- CORS middleware configured for http://localhost:5173
- get_current_user: rejects missing/invalid tokens, accepts valid ones
- require_role: enforces role restrictions across worker/verifier/advocate
"""
from unittest.mock import AsyncMock, MagicMock, patch

LOCALHOST_ORIGIN = "http://localhost:5173"


class TestHealthEndpoint:
    def test_health_returns_200(self, main_client):
        resp = main_client.get("/health")
        assert resp.status_code == 200

    def test_health_status_is_ok(self, main_client):
        resp = main_client.get("/health")
        assert resp.json()["status"] == "ok"

    def test_health_service_is_earnings(self, main_client):
        resp = main_client.get("/health")
        assert resp.json()["service"] == "earnings"

    def test_health_has_status_and_service_keys(self, main_client):
        data = main_client.get("/health").json()
        assert "status" in data and "service" in data


class TestAppMetadata:
    def test_openapi_title_is_fairgig_earnings_service(self, main_client):
        resp = main_client.get("/openapi.json")
        assert resp.status_code == 200
        assert resp.json()["info"]["title"] == "FairGig Earnings Service"

    def test_openapi_version_is_1_0_0(self, main_client):
        resp = main_client.get("/openapi.json")
        assert resp.json()["info"]["version"] == "1.0.0"


class TestCORSMiddleware:
    def test_preflight_returns_200_or_204(self, main_client):
        resp = main_client.options(
            "/health",
            headers={
                "Origin": LOCALHOST_ORIGIN,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert resp.status_code in (200, 204)

    def test_cors_allow_origin_header_present(self, main_client):
        resp = main_client.options(
            "/health",
            headers={
                "Origin": LOCALHOST_ORIGIN,
                "Access-Control-Request-Method": "GET",
            },
        )
        assert "access-control-allow-origin" in resp.headers

    def test_cors_allows_localhost_5173_origin(self, main_client):
        resp = main_client.options(
            "/health",
            headers={
                "Origin": LOCALHOST_ORIGIN,
                "Access-Control-Request-Method": "GET",
            },
        )
        origin = resp.headers.get("access-control-allow-origin", "")
        assert origin == LOCALHOST_ORIGIN or origin == "*"

    def test_cors_allow_credentials_is_true(self, main_client):
        resp = main_client.options(
            "/health",
            headers={
                "Origin": LOCALHOST_ORIGIN,
                "Access-Control-Request-Method": "GET",
            },
        )
        creds = resp.headers.get("access-control-allow-credentials", "")
        assert creds.lower() == "true"


class TestGetCurrentUser:
    def _mock_auth(self, status_code: int, data: dict = None):
        resp = MagicMock()
        resp.status_code = status_code
        resp.json.return_value = data or {}
        return resp

    def test_no_auth_header_returns_401_or_403(self, dep_client):
        resp = dep_client.get("/need-auth")
        assert resp.status_code in (401, 403)

    def test_wrong_scheme_returns_401_or_403(self, dep_client):
        resp = dep_client.get("/need-auth", headers={"Authorization": "Token bad"})
        assert resp.status_code in (401, 403)

    def test_auth_service_returning_401_raises_401(self, dep_client):
        mock_resp = self._mock_auth(401)
        with patch("app.dependencies.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_resp)
            resp = dep_client.get("/need-auth", headers={"Authorization": "Bearer bad-token"})
        assert resp.status_code == 401

    def test_auth_service_returning_403_raises_401(self, dep_client):
        mock_resp = self._mock_auth(403)
        with patch("app.dependencies.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_resp)
            resp = dep_client.get("/need-auth", headers={"Authorization": "Bearer bad-token"})
        assert resp.status_code == 401

    def test_valid_token_returns_200(self, dep_client):
        mock_resp = self._mock_auth(200, WORKER := {"user_id": "ww-0001", "role": "worker", "city_zone_id": None})
        with patch("app.dependencies.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_resp)
            resp = dep_client.get("/need-auth", headers={"Authorization": "Bearer good-token"})
        assert resp.status_code == 200

    def test_valid_token_returns_role_in_body(self, dep_client):
        user = {"user_id": "ww-0001", "role": "worker", "city_zone_id": None}
        mock_resp = self._mock_auth(200, user)
        with patch("app.dependencies.httpx.AsyncClient") as mock_cls:
            mock_cls.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_resp)
            resp = dep_client.get("/need-auth", headers={"Authorization": "Bearer good-token"})
        assert resp.json()["role"] == "worker"


class TestRequireRole:
    def test_worker_can_access_worker_route(self, dep_client_as_worker):
        resp = dep_client_as_worker.get("/need-worker")
        assert resp.status_code == 200

    def test_worker_role_returned_on_worker_route(self, dep_client_as_worker):
        resp = dep_client_as_worker.get("/need-worker")
        assert resp.json()["role"] == "worker"

    def test_advocate_blocked_from_worker_only_route(self, dep_client_as_advocate):
        resp = dep_client_as_advocate.get("/need-worker")
        assert resp.status_code == 403

    def test_verifier_blocked_from_worker_only_route(self, dep_client_as_verifier):
        resp = dep_client_as_verifier.get("/need-worker")
        assert resp.status_code == 403

    def test_verifier_can_access_verifier_route(self, dep_client_as_verifier):
        resp = dep_client_as_verifier.get("/need-verifier")
        assert resp.status_code == 200

    def test_worker_blocked_from_verifier_route(self, dep_client_as_worker):
        resp = dep_client_as_worker.get("/need-verifier")
        assert resp.status_code == 403

    def test_advocate_blocked_from_verifier_route(self, dep_client_as_advocate):
        resp = dep_client_as_advocate.get("/need-verifier")
        assert resp.status_code == 403

    def test_advocate_can_access_advocate_route(self, dep_client_as_advocate):
        resp = dep_client_as_advocate.get("/need-advocate")
        assert resp.status_code == 200

    def test_worker_blocked_from_advocate_route(self, dep_client_as_worker):
        resp = dep_client_as_worker.get("/need-advocate")
        assert resp.status_code == 403

    def test_verifier_blocked_from_advocate_route(self, dep_client_as_verifier):
        resp = dep_client_as_verifier.get("/need-advocate")
        assert resp.status_code == 403
