"""Shared fixtures for all analytics tests."""
import pytest
from unittest.mock import MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user
from app.database import get_db

ADVOCATE = {"user_id": "aa-0001", "role": "advocate", "city_zone_id": None}
WORKER   = {"user_id": "ww-0001", "role": "worker",   "city_zone_id": None}
AUTH_HDR = {"Authorization": "Bearer fake-token"}


class MockRow:
    """Mimics a SQLAlchemy row with _mapping dict and index access."""
    def __init__(self, **kwargs):
        self._mapping = kwargs

    def __getitem__(self, i):
        return list(self._mapping.values())[i]


class FakeRow:
    """Mimics a SQLAlchemy row with positional index access only."""
    def __init__(self, *values):
        self._values = values

    def __getitem__(self, i):
        return self._values[i]


def make_list_session(rows):
    """Mock session whose execute() returns rows via fetchall()."""
    result = MagicMock()
    result.fetchall.return_value = rows
    session = MagicMock()
    session.execute = AsyncMock(return_value=result)
    return session


def make_sequence_session(*results):
    """Mock session that returns different results on consecutive execute() calls."""
    session = MagicMock()
    session.execute = AsyncMock(side_effect=list(results))
    return session


def make_scalar_result(value):
    r = MagicMock()
    r.scalar.return_value = value
    return r


def make_fetchone_result(*values):
    row = FakeRow(*values)
    r = MagicMock()
    r.fetchone.return_value = row
    return r


def db_override(session):
    async def _():
        yield session
    return _


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def advocate_client():
    app.dependency_overrides[get_current_user] = lambda: ADVOCATE
    return TestClient(app)


@pytest.fixture
def worker_client():
    app.dependency_overrides[get_current_user] = lambda: WORKER
    return TestClient(app)


@pytest.fixture
def bare_client():
    app.dependency_overrides.clear()
    return TestClient(app, raise_server_exceptions=False)
