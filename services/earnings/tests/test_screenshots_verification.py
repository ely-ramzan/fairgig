"""
TDD Phase A4 — Screenshot upload + Verification state machine

Tests for:
  can_transition          — state machine guard
  POST /shifts/:id/screenshot   — upload screenshot, reset disputed
  GET  /shifts/:id/screenshot   — retrieve URL (+ thumbnail variant)
  GET  /verification-queue      — paginated pending shifts (verifier only)
  POST /shifts/:id/verify       — verifier decision + 409 on invalid transition
"""
import io
import uuid
from datetime import date
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user
from app.database import get_db
from tests.conftest import AUTH_HDR, db_override

# ── Constants ────────────────────────────────────────────────────────────────
WORKER_ID   = "00000000-0000-0000-0000-000000000001"
VERIFIER_ID = "00000000-0000-0000-0000-000000000002"
SHIFT_ID    = "00000000-0000-0000-0000-000000000003"
OTHER_WID   = "00000000-0000-0000-0000-000000000099"

WORKER   = {"user_id": WORKER_ID,   "role": "worker",   "city_zone_id": None}
VERIFIER = {"user_id": VERIFIER_ID, "role": "verifier", "city_zone_id": None}
AUTH_HDR = {"Authorization": "Bearer fake-token"}

FAKE_SCREENSHOT_UPLOAD = {
    "public_id": "fairgig/screenshots/some-key",
    "secure_url": "https://res.cloudinary.com/demo/image/upload/fairgig/screenshots/some-key",
    "width": 1200,
    "height": 800,
    "format": "png",
}


# ── Mock helpers ─────────────────────────────────────────────────────────────

def make_shift(worker_id: str = WORKER_ID, status: str = "pending"):
    s = MagicMock()
    s.id = uuid.UUID(SHIFT_ID)
    s.worker_id = uuid.UUID(worker_id)
    s.verification_status = status
    s.shift_date = date(2026, 1, 15)
    s.gross_earned = 2500
    s.platform_deductions = 550
    s.net_received = 1950
    s.hours_worked = 6
    s.import_source = "manual"
    return s


def make_screenshot():
    sc = MagicMock()
    sc.id = uuid.uuid4()
    sc.shift_log_id = uuid.UUID(SHIFT_ID)
    sc.cloudinary_public_id = "fairgig/screenshots/some-key"
    sc.cloudinary_url = "https://res.cloudinary.com/demo/image/upload/fairgig/screenshots/some-key"
    sc.original_filename = "shift_screenshot.png"
    sc.file_size_bytes = 48000
    sc.width = 1200
    sc.height = 800
    sc.format = "png"
    return sc


def make_verification(status: str = "verified"):
    v = MagicMock()
    v.id = uuid.uuid4()
    v.shift_log_id = uuid.UUID(SHIFT_ID)
    v.verifier_id = uuid.UUID(VERIFIER_ID)
    v.status = status
    v.notes = "Looks correct"
    v.verifier_gross = None
    v.verifier_deductions = None
    return v


class MockSession:
    """FIFO execute queue; also tracks add/delete."""

    def __init__(self, *execute_results):
        self._queue = list(execute_results)
        self.added = []
        self.deleted = []

    async def execute(self, _stmt):
        if self._queue:
            return self._queue.pop(0)
        r = MagicMock()
        r.scalar_one_or_none.return_value = None
        r.scalar.return_value = 0
        r.scalars.return_value.all.return_value = []
        return r

    def add(self, obj):
        self.added.append(obj)

    async def delete(self, obj):
        self.deleted.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        pass

    async def refresh(self, obj):
        pass


def make_scalar_one_or_none(obj):
    r = MagicMock()
    r.scalar_one_or_none.return_value = obj
    return r


def make_scalars_all(items):
    r = MagicMock()
    r.scalars.return_value.all.return_value = items
    return r


def make_scalar(val):
    r = MagicMock()
    r.scalar.return_value = val
    return r


def make_client(user: dict, session: MockSession):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db] = db_override(session)
    return TestClient(app)


# ── TestVerificationService ───────────────────────────────────────────────────

class TestVerificationService:
    def test_pending_to_verified_allowed(self):
        from app.services.verification_service import can_transition
        assert can_transition("pending", "verified") is True

    def test_pending_to_disputed_allowed(self):
        from app.services.verification_service import can_transition
        assert can_transition("pending", "disputed") is True

    def test_pending_to_unverifiable_allowed(self):
        from app.services.verification_service import can_transition
        assert can_transition("pending", "unverifiable") is True

    def test_disputed_to_pending_allowed(self):
        from app.services.verification_service import can_transition
        assert can_transition("disputed", "pending") is True

    def test_verified_is_final_no_transitions(self):
        from app.services.verification_service import can_transition
        assert can_transition("verified", "disputed") is False

    def test_verified_to_pending_not_allowed(self):
        from app.services.verification_service import can_transition
        assert can_transition("verified", "pending") is False

    def test_unverifiable_is_final_no_transitions(self):
        from app.services.verification_service import can_transition
        assert can_transition("unverifiable", "verified") is False

    def test_pending_to_pending_not_allowed(self):
        from app.services.verification_service import can_transition
        assert can_transition("pending", "pending") is False


# ── TestScreenshotUpload ──────────────────────────────────────────────────────

class TestScreenshotUpload:
    def _post(self, session: MockSession, user: dict = None):
        user = user or WORKER
        client = make_client(user, session)
        with patch("app.routes.screenshots.upload_screenshot",
                   return_value=FAKE_SCREENSHOT_UPLOAD):
            return client.post(
                f"/api/earnings/shifts/{SHIFT_ID}/screenshot",
                files={"file": ("shot.png", io.BytesIO(b"PNG_DATA"), "image/png")},
                headers=AUTH_HDR,
            )

    def test_returns_201(self):
        shift = make_shift()
        session = MockSession(
            make_scalar_one_or_none(shift),   # ShiftLog lookup
            make_scalar_one_or_none(None),    # existing Screenshot lookup
        )
        assert self._post(session).status_code == 201

    def test_response_has_url(self):
        shift = make_shift()
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        resp = self._post(session)
        assert "url" in resp.json()

    def test_response_has_original_filename(self):
        shift = make_shift()
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        resp = self._post(session)
        assert "original_filename" in resp.json()

    def test_screenshot_added_to_db(self):
        shift = make_shift()
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        self._post(session)
        from app.models import Screenshot
        assert any(isinstance(o, Screenshot) for o in session.added)

    def test_shift_not_found_returns_404(self):
        session = MockSession(make_scalar_one_or_none(None))
        assert self._post(session).status_code == 404

    def test_other_workers_shift_returns_403(self):
        shift = make_shift(worker_id=OTHER_WID)
        session = MockSession(make_scalar_one_or_none(shift))
        assert self._post(session).status_code == 403

    def test_verifier_cannot_upload_returns_403(self):
        session = MockSession()
        assert self._post(session, user=VERIFIER).status_code == 403

    def test_requires_auth(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            f"/api/earnings/shifts/{SHIFT_ID}/screenshot",
            files={"file": ("s.png", io.BytesIO(b"data"), "image/png")},
        )
        assert resp.status_code in (401, 403)

    def test_disputed_shift_resets_to_pending(self):
        shift = make_shift(status="disputed")
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        self._post(session)
        assert shift.verification_status == "pending"

    def test_pending_shift_status_unchanged(self):
        shift = make_shift(status="pending")
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        self._post(session)
        assert shift.verification_status == "pending"

    def test_existing_screenshot_replaced(self):
        shift = make_shift()
        old_sc = make_screenshot()
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(old_sc),   # existing screenshot found
        )
        self._post(session)
        assert old_sc in session.deleted


# ── TestScreenshotGet ─────────────────────────────────────────────────────────

class TestScreenshotGet:
    def _get(self, session: MockSession, thumbnail: bool = False):
        client = make_client(WORKER, session)
        url = f"/api/earnings/shifts/{SHIFT_ID}/screenshot"
        if thumbnail:
            url += "?thumbnail=true"
        return client.get(url, headers=AUTH_HDR)

    def test_returns_200(self):
        sc = make_screenshot()
        session = MockSession(make_scalar_one_or_none(sc))
        assert self._get(session).status_code == 200

    def test_response_has_url(self):
        sc = make_screenshot()
        session = MockSession(make_scalar_one_or_none(sc))
        resp = self._get(session)
        assert "url" in resp.json()

    def test_response_has_original_filename(self):
        sc = make_screenshot()
        session = MockSession(make_scalar_one_or_none(sc))
        resp = self._get(session)
        assert "original_filename" in resp.json()

    def test_no_screenshot_returns_404(self):
        session = MockSession(make_scalar_one_or_none(None))
        assert self._get(session).status_code == 404

    def test_thumbnail_true_transforms_url(self):
        sc = make_screenshot()
        session = MockSession(make_scalar_one_or_none(sc))
        resp = self._get(session, thumbnail=True)
        assert "w_200" in resp.json()["url"]


# ── TestVerificationQueue ─────────────────────────────────────────────────────

class TestVerificationQueue:
    def _get(self, session: MockSession, user: dict = None):
        user = user or VERIFIER
        client = make_client(user, session)
        return client.get("/api/earnings/verification-queue", headers=AUTH_HDR)

    def test_verifier_gets_200(self):
        session = MockSession(
            make_scalars_all([make_shift()]),
            make_scalar(1),
        )
        assert self._get(session).status_code == 200

    def test_worker_gets_403(self):
        session = MockSession()
        assert self._get(session, user=WORKER).status_code == 403

    def test_response_has_items(self):
        session = MockSession(
            make_scalars_all([make_shift()]),
            make_scalar(1),
        )
        assert "items" in self._get(session).json()

    def test_response_has_total(self):
        session = MockSession(
            make_scalars_all([make_shift()]),
            make_scalar(1),
        )
        assert "total" in self._get(session).json()

    def test_response_has_pagination_fields(self):
        session = MockSession(
            make_scalars_all([]),
            make_scalar(0),
        )
        body = self._get(session).json()
        assert "page" in body and "limit" in body and "total_pages" in body

    def test_empty_queue_returns_empty_items(self):
        session = MockSession(
            make_scalars_all([]),
            make_scalar(0),
        )
        body = self._get(session).json()
        assert body["items"] == [] and body["total"] == 0

    def test_requires_auth(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/earnings/verification-queue")
        assert resp.status_code in (401, 403)


# ── TestVerifyShift ───────────────────────────────────────────────────────────

class TestVerifyShift:
    def _post(self, session: MockSession, body: dict, user: dict = None):
        user = user or VERIFIER
        client = make_client(user, session)
        return client.post(
            f"/api/earnings/shifts/{SHIFT_ID}/verify",
            json=body,
            headers=AUTH_HDR,
        )

    def test_verified_returns_200(self):
        shift = make_shift(status="pending")
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        resp = self._post(session, {"status": "verified"})
        assert resp.status_code == 200

    def test_disputed_returns_200(self):
        shift = make_shift(status="pending")
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        resp = self._post(session, {"status": "disputed"})
        assert resp.status_code == 200

    def test_unverifiable_returns_200(self):
        shift = make_shift(status="pending")
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        resp = self._post(session, {"status": "unverifiable"})
        assert resp.status_code == 200

    def test_shift_status_updated_to_verified(self):
        shift = make_shift(status="pending")
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        self._post(session, {"status": "verified"})
        assert shift.verification_status == "verified"

    def test_verification_record_added(self):
        shift = make_shift(status="pending")
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        self._post(session, {"status": "verified"})
        from app.models import Verification
        assert any(isinstance(o, Verification) for o in session.added)

    def test_invalid_status_string_returns_400(self):
        shift = make_shift(status="pending")
        session = MockSession(make_scalar_one_or_none(shift))
        resp = self._post(session, {"status": "approved"})
        # Literal constraint rejects at schema level (422) before route code runs
        assert resp.status_code in (400, 422)

    def test_shift_not_found_returns_404(self):
        session = MockSession(make_scalar_one_or_none(None))
        resp = self._post(session, {"status": "verified"})
        assert resp.status_code == 404

    def test_verified_to_disputed_returns_409(self):
        shift = make_shift(status="verified")
        session = MockSession(make_scalar_one_or_none(shift))
        resp = self._post(session, {"status": "disputed"})
        assert resp.status_code == 409

    def test_unverifiable_to_verified_returns_409(self):
        shift = make_shift(status="unverifiable")
        session = MockSession(make_scalar_one_or_none(shift))
        resp = self._post(session, {"status": "verified"})
        assert resp.status_code == 409

    def test_worker_cannot_verify_returns_403(self):
        session = MockSession()
        resp = self._post(session, {"status": "verified"}, user=WORKER)
        assert resp.status_code == 403

    def test_requires_auth(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            f"/api/earnings/shifts/{SHIFT_ID}/verify",
            json={"status": "verified"},
        )
        assert resp.status_code in (401, 403)

    def test_notes_stored_in_verification(self):
        shift = make_shift(status="pending")
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(None),
        )
        self._post(session, {"status": "verified", "notes": "All good"})
        from app.models import Verification
        verifications = [o for o in session.added if isinstance(o, Verification)]
        assert verifications[0].notes == "All good"

    def test_existing_verification_replaced(self):
        shift = make_shift(status="pending")
        old_v = make_verification(status="disputed")
        session = MockSession(
            make_scalar_one_or_none(shift),
            make_scalar_one_or_none(old_v),
        )
        self._post(session, {"status": "verified"})
        assert old_v in session.deleted
