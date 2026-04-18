"""
TDD Phase A3 — Import Service: unit tests

Tests for:
  normalize_header  — maps CSV column aliases to canonical names
  parse_date        — multi-format date parser
  parse_csv         — full CSV → (valid_rows, errors) pipeline
  parse_excel       — same pipeline for .xlsx bytes
"""
import io
import pytest
from datetime import date
from decimal import Decimal

from app.services.import_service import normalize_header, parse_date, parse_csv, parse_excel

PLATFORM_MAP = {"careem": "p-uuid-001", "indrive": "p-uuid-002"}

VALID_CSV = (
    b"shift_date,platform,gross_earned,platform_deductions,net_received,hours_worked\n"
    b"2026-01-15,Careem,2500,550,1950,6\n"
    b"2026-01-16,Careem,2300,506,1794,5.5\n"
)

SEMICOLON_CSV = (
    b"shift_date;platform;gross_earned;platform_deductions;net_received;hours_worked\n"
    b"2026-01-15;Careem;2500;550;1950;6\n"
)

CSV_BAD_NET = (
    b"shift_date,platform,gross_earned,platform_deductions,net_received,hours_worked\n"
    b"2026-01-15,Careem,2500,550,1950,6\n"
    b"2026-01-16,Careem,2500,550,500,6\n"   # net 500 is way off (expected 1950)
)

CSV_UNKNOWN_PLATFORM = (
    b"shift_date,platform,gross_earned,platform_deductions,net_received,hours_worked\n"
    b"2026-01-15,UberEats,2500,550,1950,6\n"
)

CSV_HEADER_ONLY = (
    b"shift_date,platform,gross_earned,platform_deductions,net_received,hours_worked\n"
)

CSV_ALIAS_HEADERS = (
    b"date,app,gross,deductions,net,hours\n"
    b"2026-01-15,Careem,2500,550,1950,6\n"
)


def make_excel(rows: list[list]) -> bytes:
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


# ── normalize_header ──────────────────────────────────────────────────────────
class TestNormalizeHeader:
    def test_date_maps_to_shift_date(self):
        assert normalize_header("date") == "shift_date"

    def test_shift_date_identity(self):
        assert normalize_header("shift_date") == "shift_date"

    def test_shift_date_with_space(self):
        assert normalize_header("shift date") == "shift_date"

    def test_gross_maps_to_gross_earned(self):
        assert normalize_header("gross") == "gross_earned"

    def test_earnings_maps_to_gross_earned(self):
        assert normalize_header("earnings") == "gross_earned"

    def test_deductions_maps_to_platform_deductions(self):
        assert normalize_header("deductions") == "platform_deductions"

    def test_commission_maps_to_platform_deductions(self):
        assert normalize_header("commission") == "platform_deductions"

    def test_net_maps_to_net_received(self):
        assert normalize_header("net") == "net_received"

    def test_hours_maps_to_hours_worked(self):
        assert normalize_header("hours") == "hours_worked"

    def test_app_maps_to_platform(self):
        assert normalize_header("app") == "platform"

    def test_unknown_header_passes_through(self):
        assert normalize_header("unknown_field") == "unknown_field"

    def test_strips_whitespace(self):
        assert normalize_header("  gross  ") == "gross_earned"

    def test_lowercases_input(self):
        assert normalize_header("GROSS") == "gross_earned"


# ── parse_date ────────────────────────────────────────────────────────────────
class TestParseDate:
    def test_iso_format_yyyy_mm_dd(self):
        assert parse_date("2026-01-15") == date(2026, 1, 15)

    def test_dd_slash_mm_slash_yyyy(self):
        assert parse_date("15/01/2026") == date(2026, 1, 15)

    def test_mm_slash_dd_slash_yyyy(self):
        # day > 12 forces MM/DD/YYYY (DD/MM/YYYY would give invalid month 15)
        assert parse_date("01/15/2026") == date(2026, 1, 15)

    def test_dd_dash_mm_dash_yyyy(self):
        assert parse_date("15-01-2026") == date(2026, 1, 15)

    def test_strips_surrounding_whitespace(self):
        assert parse_date("  2026-01-15  ") == date(2026, 1, 15)

    def test_invalid_string_raises_value_error(self):
        with pytest.raises(ValueError):
            parse_date("not-a-date")

    def test_empty_string_raises_value_error(self):
        with pytest.raises(ValueError):
            parse_date("")


# ── parse_csv ─────────────────────────────────────────────────────────────────
class TestParseCSV:
    def test_two_valid_rows_returns_two_items(self):
        valid, errors = parse_csv(VALID_CSV, PLATFORM_MAP)
        assert len(valid) == 2 and len(errors) == 0

    def test_valid_row_has_platform_id(self):
        valid, _ = parse_csv(VALID_CSV, PLATFORM_MAP)
        assert "platform_id" in valid[0]

    def test_valid_row_has_shift_date(self):
        valid, _ = parse_csv(VALID_CSV, PLATFORM_MAP)
        assert "shift_date" in valid[0]

    def test_valid_row_has_gross_earned(self):
        valid, _ = parse_csv(VALID_CSV, PLATFORM_MAP)
        assert "gross_earned" in valid[0]

    def test_valid_row_has_platform_deductions(self):
        valid, _ = parse_csv(VALID_CSV, PLATFORM_MAP)
        assert "platform_deductions" in valid[0]

    def test_valid_row_has_net_received(self):
        valid, _ = parse_csv(VALID_CSV, PLATFORM_MAP)
        assert "net_received" in valid[0]

    def test_valid_row_has_hours_worked(self):
        valid, _ = parse_csv(VALID_CSV, PLATFORM_MAP)
        assert "hours_worked" in valid[0]

    def test_platform_id_resolved_from_map(self):
        valid, _ = parse_csv(VALID_CSV, PLATFORM_MAP)
        assert valid[0]["platform_id"] == "p-uuid-001"

    def test_bad_net_produces_error(self):
        valid, errors = parse_csv(CSV_BAD_NET, PLATFORM_MAP)
        assert len(errors) == 1

    def test_bad_net_valid_row_still_imported(self):
        valid, errors = parse_csv(CSV_BAD_NET, PLATFORM_MAP)
        assert len(valid) == 1

    def test_unknown_platform_produces_error(self):
        _, errors = parse_csv(CSV_UNKNOWN_PLATFORM, PLATFORM_MAP)
        assert len(errors) == 1

    def test_error_entry_has_row_number(self):
        _, errors = parse_csv(CSV_UNKNOWN_PLATFORM, PLATFORM_MAP)
        assert "row" in errors[0]

    def test_error_entry_has_reason(self):
        _, errors = parse_csv(CSV_UNKNOWN_PLATFORM, PLATFORM_MAP)
        assert "reason" in errors[0]

    def test_semicolon_delimiter_parsed_correctly(self):
        valid, errors = parse_csv(SEMICOLON_CSV, PLATFORM_MAP)
        assert len(valid) == 1 and len(errors) == 0

    def test_header_only_returns_empty_lists(self):
        valid, errors = parse_csv(CSV_HEADER_ONLY, PLATFORM_MAP)
        assert valid == [] and errors == []

    def test_alias_headers_resolved(self):
        # date,app,gross,deductions,net,hours → all canonical aliases
        valid, errors = parse_csv(CSV_ALIAS_HEADERS, PLATFORM_MAP)
        assert len(valid) == 1 and len(errors) == 0

    def test_net_within_2_percent_tolerance_is_valid(self):
        # gross=2500, deductions=550 → expected=1950, tolerance=39; net=1980 is 30 off → valid
        csv = (
            b"shift_date,platform,gross_earned,platform_deductions,net_received,hours_worked\n"
            b"2026-01-15,Careem,2500,550,1980,6\n"
        )
        valid, errors = parse_csv(csv, PLATFORM_MAP)
        assert len(valid) == 1 and len(errors) == 0


# ── parse_excel ───────────────────────────────────────────────────────────────
class TestParseExcel:
    def test_two_valid_rows(self):
        xlsx = make_excel([
            ["shift_date", "platform", "gross_earned", "platform_deductions", "net_received", "hours_worked"],
            ["2026-01-15", "Careem", 2500, 550, 1950, 6],
            ["2026-01-16", "Careem", 2300, 506, 1794, 5.5],
        ])
        valid, errors = parse_excel(xlsx, PLATFORM_MAP)
        assert len(valid) == 2 and len(errors) == 0

    def test_bad_net_produces_error(self):
        xlsx = make_excel([
            ["shift_date", "platform", "gross_earned", "platform_deductions", "net_received", "hours_worked"],
            ["2026-01-15", "Careem", 2500, 550, 500, 6],   # net way off
        ])
        _, errors = parse_excel(xlsx, PLATFORM_MAP)
        assert len(errors) == 1

    def test_unknown_platform_produces_error(self):
        xlsx = make_excel([
            ["shift_date", "platform", "gross_earned", "platform_deductions", "net_received", "hours_worked"],
            ["2026-01-15", "UberEats", 2500, 550, 1950, 6],
        ])
        _, errors = parse_excel(xlsx, PLATFORM_MAP)
        assert len(errors) == 1
