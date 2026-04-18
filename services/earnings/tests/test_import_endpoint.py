"""
TDD Phase A3 — Import Endpoint: HTTP tests

Tests for:
  POST /api/earnings/shifts/import  — upload CSV/XLSX → create shifts + FileUpload record
  GET  /api/earnings/imports        — list this worker's import history
"""
import io
import uuid
from datetime import datetime
from unittest.mock import MagicMock, AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user, require_role
from app.database import get_db
from tests.conftest import AUTH_HDR, db_override

WORKER_ID   = "00000000-0000-0000-0000-000000000001"
PLATFORM_ID = "00000000-0000-0000-0000-000000000002"
UPLOAD_ID   = "00000000-0000-0000-0000-000000000010"

WORKER = {"user_id": WORKER_ID, "role": "worker", "city_zone_id": None}

VALID_CSV = (
    b"shift_date,platform,gross_earned,platform_deductions,net_received,hours_worked\n"
    b"2026-01-15,Careem,2500,550,1950,6\n"
    b"2026-01-16,Careem,2300,506,1794,5.5\n"
)

CSV_ONE_BAD = (
    b"shift_date,platform,gross_earned,platform_deductions,net_received,hours_worked\n"
    b"2026-01-15,Careem,2500,550,1950,6\n"
    b"2026-01-16,Careem,2500,550,500,6\n"   # bad net
)

CSV_UNKNOWN_PLATFORM = (
    b"shift_date,platform,gross_earned,platform_deductions,net_received,hours_worked\n"
    b"2026-01-15,UberEats,2500,550,1950,6\n"
)


def make_platform(name: str, pid: str = None):
    p = MagicMock()
    p.id = uuid.UUID(pid) if pid else uuid.uuid4()
    p.name = name
    p.category = "ride"
    return p


def make_file_upload(uid: str = UPLOAD_ID):
    fu = MagicMock()
    fu.id = uuid.UUID(uid)
    fu.worker_id = uuid.UUID(WORKER_ID)
    fu.cloudinary_public_id = "fairgig/imports/some-key"
    fu.cloudinary_url = "https://res.cloudinary.com/demo/raw/upload/fairgig/imports/some-key"
    fu.original_filename = "shifts.csv"
    fu.file_type = "csv"
    fu.file_size_bytes = 120
    fu.rows_imported = 2
    fu.rows_skipped = 0
    fu.rows_errored = 0
    fu.import_status = "completed"
    fu.error_summary = None
    fu.uploaded_at = datetime(2026, 1, 15, 10, 0, 0)
    fu.processed_at = datetime(2026, 1, 15, 10, 0, 1)
    return fu


class MockImportSession:
    """Mock session for import endpoint.

    execute_results: FIFO queue of return values for db.execute() calls.
    After the queue is exhausted each extra call returns an empty scalars mock.
    """

    def __init__(self, *execute_results):
        self._queue = list(execute_results)
        self.added = []

    async def execute(self, _stmt):
        if self._queue:
            return self._queue.pop(0)
        result = MagicMock()
        result.scalars.return_value.all.return_value = []
        return result

    def add(self, obj):
        self.added.append(obj)

    async def flush(self):
        pass

    async def commit(self):
        pass

    async def refresh(self, obj):
        pass


def make_scalars_all(items):
    r = MagicMock()
    r.scalars.return_value.all.return_value = items
    return r


def make_client_with_session(session):
    app.dependency_overrides[get_current_user] = lambda: WORKER
    app.dependency_overrides[get_db] = db_override(session)
    return TestClient(app)


FAKE_UPLOAD_RESULT = {
    "public_id": "fairgig/imports/some-key",
    "secure_url": "https://res.cloudinary.com/demo/raw/upload/fairgig/imports/some-key",
}


# ── POST /api/earnings/shifts/import ─────────────────────────────────────────

class TestImportCSV:
    def _make_client(self, platform_name="Careem", platform_id=PLATFORM_ID):
        platform = make_platform(platform_name, platform_id)
        session = MockImportSession(make_scalars_all([platform]))
        return make_client_with_session(session), session

    def test_returns_201_for_valid_csv(self):
        client, _ = self._make_client()
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            resp = client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.csv", io.BytesIO(VALID_CSV), "text/csv")},
                headers=AUTH_HDR,
            )
        assert resp.status_code == 201

    def test_response_has_rows_imported(self):
        client, _ = self._make_client()
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            resp = client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.csv", io.BytesIO(VALID_CSV), "text/csv")},
                headers=AUTH_HDR,
            )
        assert resp.json()["rows_imported"] == 2

    def test_response_has_rows_errored(self):
        client, _ = self._make_client()
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            resp = client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.csv", io.BytesIO(VALID_CSV), "text/csv")},
                headers=AUTH_HDR,
            )
        assert resp.json()["rows_errored"] == 0

    def test_response_has_upload_id(self):
        client, _ = self._make_client()
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            resp = client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.csv", io.BytesIO(VALID_CSV), "text/csv")},
                headers=AUTH_HDR,
            )
        assert "upload_id" in resp.json()

    def test_response_has_errors_list(self):
        client, _ = self._make_client()
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            resp = client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.csv", io.BytesIO(VALID_CSV), "text/csv")},
                headers=AUTH_HDR,
            )
        assert "errors" in resp.json()

    def test_shift_objects_added_to_db(self):
        client, session = self._make_client()
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.csv", io.BytesIO(VALID_CSV), "text/csv")},
                headers=AUTH_HDR,
            )
        shift_adds = [o for o in session.added if hasattr(o, "shift_date")]
        assert len(shift_adds) == 2

    def test_file_upload_object_added_to_db(self):
        client, session = self._make_client()
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.csv", io.BytesIO(VALID_CSV), "text/csv")},
                headers=AUTH_HDR,
            )
        from app.models import FileUpload
        file_adds = [o for o in session.added if isinstance(o, FileUpload)]
        assert len(file_adds) == 1

    def test_one_bad_net_row_reported_in_errors(self):
        client, _ = self._make_client()
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            resp = client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.csv", io.BytesIO(CSV_ONE_BAD), "text/csv")},
                headers=AUTH_HDR,
            )
        assert resp.json()["rows_errored"] == 1

    def test_one_bad_net_row_still_imports_valid(self):
        client, _ = self._make_client()
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            resp = client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.csv", io.BytesIO(CSV_ONE_BAD), "text/csv")},
                headers=AUTH_HDR,
            )
        assert resp.json()["rows_imported"] == 1

    def test_unknown_platform_row_goes_to_errors(self):
        client, _ = self._make_client()
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            resp = client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.csv", io.BytesIO(CSV_UNKNOWN_PLATFORM), "text/csv")},
                headers=AUTH_HDR,
            )
        assert resp.json()["rows_errored"] == 1 and resp.json()["rows_imported"] == 0

    def test_unsupported_file_type_returns_422(self):
        platform = make_platform("Careem", PLATFORM_ID)
        session = MockImportSession(make_scalars_all([platform]))
        client = make_client_with_session(session)
        resp = client.post(
            "/api/earnings/shifts/import",
            files={"file": ("data.txt", io.BytesIO(b"some,data"), "text/plain")},
            headers=AUTH_HDR,
        )
        assert resp.status_code == 422

    def test_requires_worker_role(self):
        from app.dependencies import get_current_user as gcu
        app.dependency_overrides[gcu] = lambda: {"user_id": "vv-001", "role": "verifier"}
        app.dependency_overrides[get_db] = db_override(MockImportSession())
        client = TestClient(app)
        resp = client.post(
            "/api/earnings/shifts/import",
            files={"file": ("f.csv", io.BytesIO(VALID_CSV), "text/csv")},
            headers=AUTH_HDR,
        )
        assert resp.status_code == 403

    def test_requires_auth(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.post(
            "/api/earnings/shifts/import",
            files={"file": ("f.csv", io.BytesIO(VALID_CSV), "text/csv")},
        )
        assert resp.status_code in (401, 403)


class TestImportXLSX:
    def _make_xlsx(self):
        import openpyxl, io as _io
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.append(["shift_date", "platform", "gross_earned",
                   "platform_deductions", "net_received", "hours_worked"])
        ws.append(["2026-01-15", "Careem", 2500, 550, 1950, 6])
        ws.append(["2026-01-16", "Careem", 2300, 506, 1794, 5.5])
        buf = _io.BytesIO()
        wb.save(buf)
        return buf.getvalue()

    def test_xlsx_returns_201(self):
        platform = make_platform("Careem", PLATFORM_ID)
        session = MockImportSession(make_scalars_all([platform]))
        client = make_client_with_session(session)
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            resp = client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.xlsx",
                                io.BytesIO(self._make_xlsx()),
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                headers=AUTH_HDR,
            )
        assert resp.status_code == 201

    def test_xlsx_imports_two_rows(self):
        platform = make_platform("Careem", PLATFORM_ID)
        session = MockImportSession(make_scalars_all([platform]))
        client = make_client_with_session(session)
        with patch("app.routes.shifts.upload_raw_file", return_value=FAKE_UPLOAD_RESULT):
            resp = client.post(
                "/api/earnings/shifts/import",
                files={"file": ("shifts.xlsx",
                                io.BytesIO(self._make_xlsx()),
                                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")},
                headers=AUTH_HDR,
            )
        assert resp.json()["rows_imported"] == 2


# ── GET /api/earnings/imports ─────────────────────────────────────────────────

class TestListImports:
    def test_returns_200(self):
        fu = make_file_upload()
        session = MockImportSession(make_scalars_all([fu]))
        client = make_client_with_session(session)
        resp = client.get("/api/earnings/imports", headers=AUTH_HDR)
        assert resp.status_code == 200

    def test_returns_list(self):
        fu = make_file_upload()
        session = MockImportSession(make_scalars_all([fu]))
        client = make_client_with_session(session)
        resp = client.get("/api/earnings/imports", headers=AUTH_HDR)
        assert isinstance(resp.json(), list)

    def test_item_has_upload_id(self):
        fu = make_file_upload()
        session = MockImportSession(make_scalars_all([fu]))
        client = make_client_with_session(session)
        resp = client.get("/api/earnings/imports", headers=AUTH_HDR)
        assert "id" in resp.json()[0]

    def test_item_has_filename(self):
        fu = make_file_upload()
        session = MockImportSession(make_scalars_all([fu]))
        client = make_client_with_session(session)
        resp = client.get("/api/earnings/imports", headers=AUTH_HDR)
        assert "original_filename" in resp.json()[0]

    def test_item_has_rows_imported(self):
        fu = make_file_upload()
        session = MockImportSession(make_scalars_all([fu]))
        client = make_client_with_session(session)
        resp = client.get("/api/earnings/imports", headers=AUTH_HDR)
        assert "rows_imported" in resp.json()[0]

    def test_item_has_rows_errored(self):
        fu = make_file_upload()
        session = MockImportSession(make_scalars_all([fu]))
        client = make_client_with_session(session)
        resp = client.get("/api/earnings/imports", headers=AUTH_HDR)
        assert "rows_errored" in resp.json()[0]

    def test_item_has_import_status(self):
        fu = make_file_upload()
        session = MockImportSession(make_scalars_all([fu]))
        client = make_client_with_session(session)
        resp = client.get("/api/earnings/imports", headers=AUTH_HDR)
        assert "import_status" in resp.json()[0]

    def test_item_has_uploaded_at(self):
        fu = make_file_upload()
        session = MockImportSession(make_scalars_all([fu]))
        client = make_client_with_session(session)
        resp = client.get("/api/earnings/imports", headers=AUTH_HDR)
        assert "uploaded_at" in resp.json()[0]

    def test_empty_history_returns_empty_list(self):
        session = MockImportSession(make_scalars_all([]))
        client = make_client_with_session(session)
        resp = client.get("/api/earnings/imports", headers=AUTH_HDR)
        assert resp.json() == []

    def test_requires_auth(self):
        app.dependency_overrides.clear()
        client = TestClient(app, raise_server_exceptions=False)
        resp = client.get("/api/earnings/imports")
        assert resp.status_code in (401, 403)
