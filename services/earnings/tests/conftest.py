"""Shared fixtures for all Earnings Service tests."""
import pytest
from fastapi import FastAPI, Depends
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, AsyncMock

from app.main import app
from app.dependencies import get_current_user, require_role

WORKER   = {"user_id": "ww-0001", "role": "worker",   "city_zone_id": None}
ADVOCATE = {"user_id": "aa-0001", "role": "advocate", "city_zone_id": None}
VERIFIER = {"user_id": "vv-0001", "role": "verifier", "city_zone_id": None}
AUTH_HDR = {"Authorization": "Bearer fake-token"}

# Mini app to test dependency behaviour in isolation (no real routes needed)
_dep_app = FastAPI()


@_dep_app.get("/need-auth")
async def _need_auth(user: dict = Depends(get_current_user)):
    return {"role": user["role"]}


@_dep_app.get("/need-worker")
async def _need_worker(user: dict = Depends(require_role("worker"))):
    return {"role": user["role"]}


@_dep_app.get("/need-verifier")
async def _need_verifier(user: dict = Depends(require_role("verifier"))):
    return {"role": user["role"]}


@_dep_app.get("/need-advocate")
async def _need_advocate(user: dict = Depends(require_role("advocate"))):
    return {"role": user["role"]}


def make_auth_resp(status_code: int, data: dict = None):
    resp = MagicMock()
    resp.status_code = status_code
    resp.json.return_value = data or {}
    return resp


def db_override(session):
    async def _():
        yield session
    return _


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()
    _dep_app.dependency_overrides.clear()


@pytest.fixture
def main_client():
    return TestClient(app)


@pytest.fixture
def bare_client():
    app.dependency_overrides.clear()
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def dep_client():
    return TestClient(_dep_app, raise_server_exceptions=False)


@pytest.fixture
def dep_client_as_worker():
    _dep_app.dependency_overrides[get_current_user] = lambda: WORKER
    return TestClient(_dep_app)


@pytest.fixture
def dep_client_as_advocate():
    _dep_app.dependency_overrides[get_current_user] = lambda: ADVOCATE
    return TestClient(_dep_app)


@pytest.fixture
def dep_client_as_verifier():
    _dep_app.dependency_overrides[get_current_user] = lambda: VERIFIER
    return TestClient(_dep_app)
