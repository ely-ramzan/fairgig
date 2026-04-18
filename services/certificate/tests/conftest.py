"""Shared fixtures for Certificate Service tests."""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import MagicMock

from app.main import app
from app.dependencies import get_current_user

WORKER_ID = "00000000-0000-0000-0000-000000000001"
WORKER    = {"user_id": WORKER_ID, "role": "worker",
             "display_name": "Test Worker", "city_zone_id": None}
AUTH_HDR  = {"Authorization": "Bearer fake-token"}

MOCK_SUMMARY = {
    "total_gross": 125000.0,
    "total_deductions": 27500.0,
    "total_net": 97500.0,
    "total_hours": 300.0,
    "shift_count": 50,
    "verified_count": 40,
    "avg_commission_rate": 22.0,
    "platform_breakdown": [
        {"platform": "Careem", "shifts": 30, "net": 60000.0, "commission_pct": 22.0},
    ],
}


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def auth_client():
    app.dependency_overrides[get_current_user] = lambda: WORKER
    return TestClient(app)


@pytest.fixture
def bare_client():
    app.dependency_overrides.clear()
    return TestClient(app, raise_server_exceptions=False)
