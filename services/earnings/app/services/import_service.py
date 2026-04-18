"""CSV / Excel import helpers for shift logs.

File-level guards
-----------------
- Extension must be .csv or .xlsx
- File must not be empty
- File size ≤ 10 MB
- Encoding detected via chardet (fallback chain: utf-8-sig → latin-1)
- Delimiter auto-detected with csv.Sniffer (fallback: comma)
- Duplicate column header names → reject whole file
- Missing required columns → reject whole file
- Row count ≤ 5 000 data rows

Row-level guards
----------------
- Null-like normalization (N/A, -, null, #N/A, ?, none, n/a → empty string)
- Formula injection (=, +, -, @, | leading chars) → skip row with error
- Whitespace-only cell treated as missing
- Future shift_date → skip row
- hours_worked > 24 → skip row
- platform_deductions > gross_earned → skip row
- Within-file duplicate (platform, shift_date) → skip row
- net_received outside 2% tolerance of gross-deductions → skip row
"""
from __future__ import annotations

import csv
import io
import os
import re
from datetime import date
from decimal import Decimal, InvalidOperation

# ── Constants ─────────────────────────────────────────────────────────────────

MAX_FILE_BYTES = 10 * 1024 * 1024      # 10 MB
MAX_ROWS       = 5_000

HEADER_ALIASES: dict[str, str] = {
    "date": "shift_date",
    "shift date": "shift_date",
    "shift_date": "shift_date",
    "gross": "gross_earned",
    "earnings": "gross_earned",
    "gross_earned": "gross_earned",
    "deductions": "platform_deductions",
    "commission": "platform_deductions",
    "platform_deductions": "platform_deductions",
    "net": "net_received",
    "net_received": "net_received",
    "hours": "hours_worked",
    "hours_worked": "hours_worked",
    "app": "platform",
    "platform": "platform",
}

DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]

REQUIRED_FIELDS = {
    "shift_date", "platform", "gross_earned",
    "platform_deductions", "net_received", "hours_worked",
}

# Null-like strings that should be treated as missing
_NULL_LIKE = re.compile(
    r"^\s*(n/?a|#n/?a|\?|null|none|-|–|—)\s*$",
    re.IGNORECASE,
)

# Formula injection — leading characters Excel/Sheets treat as formulas
_FORMULA_START = re.compile(r"^[=+\-@|]")


# ── Encoding helpers ──────────────────────────────────────────────────────────

def _decode(file_bytes: bytes) -> str:
    """Decode bytes using chardet if available, then fallback chain."""
    try:
        import chardet
        detected = chardet.detect(file_bytes)
        enc = detected.get("encoding") or "utf-8-sig"
        return file_bytes.decode(enc)
    except ImportError:
        pass
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return file_bytes.decode(enc)
        except UnicodeDecodeError:
            continue
    raise ValueError("Cannot decode file — unsupported encoding")


# ── String normalization ──────────────────────────────────────────────────────

def normalize_header(raw: str) -> str:
    key = raw.strip().lower()
    return HEADER_ALIASES.get(key, key)


def _normalize_cell(value: str) -> str:
    """Strip whitespace; map null-like values to empty string."""
    stripped = value.strip() if isinstance(value, str) else str(value).strip()
    if _NULL_LIKE.match(stripped):
        return ""
    return stripped


def _check_formula_injection(value: str, field: str) -> str | None:
    """Return error string if value looks like a formula, else None."""
    if _FORMULA_START.match(value):
        return f"Potential formula injection in field {field!r}: {value[:30]!r}"
    return None


# ── Decimal helpers ───────────────────────────────────────────────────────────

_EU_DECIMAL = re.compile(r"^\d{1,3}(\.\d{3})*(,\d+)?$")   # e.g. 1.200,50
_US_COMMA   = re.compile(r"^\d{1,3}(,\d{3})*(\.\d+)?$")   # e.g. 1,200.50
_PREFIX     = re.compile(r"^[A-Z$€£₨]+\s*", re.IGNORECASE)  # PKR, $, etc.


def _parse_decimal(raw: str) -> Decimal:
    """Parse decimal strings, handling European and US formats plus currency prefixes."""
    s = _PREFIX.sub("", raw).strip()
    if _EU_DECIMAL.match(s):
        # European: remove thousands dots, replace comma decimal
        s = s.replace(".", "").replace(",", ".")
    elif _US_COMMA.match(s):
        # US: just remove thousands commas
        s = s.replace(",", "")
    try:
        return Decimal(s)
    except InvalidOperation:
        raise ValueError(f"Cannot parse number: {raw!r}")


# ── Date helpers ──────────────────────────────────────────────────────────────

def parse_date(value: str) -> date:
    from datetime import datetime
    s = value.strip()
    if not s:
        raise ValueError("Empty date string")
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {value!r}")


# ── Row validation ────────────────────────────────────────────────────────────

def _validate_row(
    row: dict,
    platform_map: dict[str, str],
    seen_keys: set[tuple],
) -> tuple[dict | None, str | None]:
    # Normalize cells
    row = {k: _normalize_cell(v) for k, v in row.items()}

    # Check formula injection in all text-ish fields
    for field in ("platform", "shift_date"):
        val = row.get(field, "")
        err = _check_formula_injection(val, field)
        if err:
            return None, err

    platform_key = row.get("platform", "").lower()
    platform_id = platform_map.get(platform_key)
    if platform_id is None:
        return None, f"Unknown platform: {row.get('platform')!r}"

    try:
        shift_date = parse_date(row["shift_date"])
    except (ValueError, KeyError) as e:
        return None, f"Bad shift_date: {e}"

    if shift_date > date.today():
        return None, f"shift_date {shift_date} is in the future"

    try:
        gross      = _parse_decimal(row["gross_earned"])
        deductions = _parse_decimal(row["platform_deductions"])
        net        = _parse_decimal(row["net_received"])
        hours      = _parse_decimal(row["hours_worked"])
    except (ValueError, KeyError) as e:
        return None, f"Bad numeric field: {e}"

    if gross <= 0:
        return None, "gross_earned must be greater than 0"
    if deductions < 0:
        return None, "platform_deductions must be >= 0"
    if hours <= 0 or hours > 24:
        return None, f"hours_worked must be between 0 and 24, got {hours}"
    if deductions > gross:
        return None, f"platform_deductions ({deductions}) exceeds gross_earned ({gross})"

    expected = gross - deductions
    if expected > 0:
        tolerance = expected * Decimal("0.02")
        if abs(net - expected) > tolerance:
            return None, (
                f"net_received {net} is outside 2% tolerance "
                f"(expected ~{expected:.2f})"
            )

    # Within-file duplicate detection
    dedup_key = (platform_key, str(shift_date))
    if dedup_key in seen_keys:
        return None, (
            f"Duplicate row: platform={row.get('platform')!r} "
            f"shift_date={shift_date}"
        )
    seen_keys.add(dedup_key)

    return {
        "platform_id": platform_id,
        "shift_date": shift_date,
        "gross_earned": gross,
        "platform_deductions": deductions,
        "net_received": net,
        "hours_worked": hours,
    }, None


# ── File-level validation ─────────────────────────────────────────────────────

def _validate_file_level(file_bytes: bytes, filename: str) -> None:
    """Raise ValueError for file-level problems before row parsing begins."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in (".csv", ".xlsx"):
        raise ValueError(f"Unsupported file extension {ext!r} — use .csv or .xlsx")
    if len(file_bytes) == 0:
        raise ValueError("Uploaded file is empty")
    if len(file_bytes) > MAX_FILE_BYTES:
        mb = len(file_bytes) / 1_048_576
        raise ValueError(f"File exceeds 10 MB limit ({mb:.1f} MB)")


def _validate_headers(headers: list[str]) -> None:
    """Raise ValueError if headers contain duplicates or miss required fields."""
    # Duplicate check (after normalisation)
    seen: set[str] = set()
    for h in headers:
        if h in seen:
            raise ValueError(f"Duplicate column header: {h!r}")
        seen.add(h)
    missing = REQUIRED_FIELDS - seen
    if missing:
        raise ValueError(
            f"Missing required columns: {', '.join(sorted(missing))}"
        )


# ── Delimiter detection ───────────────────────────────────────────────────────

def _detect_delimiter(sample: str) -> str:
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        return dialect.delimiter
    except csv.Error:
        return ","


# ── Public parse functions ────────────────────────────────────────────────────

def parse_csv(
    file_bytes: bytes,
    platform_map: dict[str, str],
    filename: str = "upload.csv",
) -> tuple[list[dict], list[dict]]:
    _validate_file_level(file_bytes, filename)

    text = _decode(file_bytes)
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        raise ValueError("CSV file contains no data rows")

    delimiter = _detect_delimiter("\n".join(lines[:5]))
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)

    raw_headers = [h for h in (reader.fieldnames or [])]
    norm_headers = [normalize_header(h) for h in raw_headers]
    _validate_headers(norm_headers)
    reader.fieldnames = norm_headers

    if sum(1 for _ in csv.DictReader(io.StringIO(text), delimiter=delimiter)) > MAX_ROWS:
        raise ValueError(f"File exceeds {MAX_ROWS} data row limit")

    # Re-create reader after counting; manually skip the header row since
    # fieldnames is pre-set (DictReader won't consume it automatically).
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    reader.fieldnames = norm_headers
    next(reader.reader, None)  # skip the raw CSV header line

    valid: list[dict] = []
    errors: list[dict] = []
    seen_keys: set[tuple] = set()

    for row_num, row in enumerate(reader, start=2):
        normalized = {normalize_header(k): v for k, v in row.items()}
        result, reason = _validate_row(normalized, platform_map, seen_keys)
        if result is not None:
            valid.append(result)
        else:
            errors.append({"row": row_num, "reason": reason})
    return valid, errors


def parse_excel(
    file_bytes: bytes,
    platform_map: dict[str, str],
    filename: str = "upload.xlsx",
) -> tuple[list[dict], list[dict]]:
    _validate_file_level(file_bytes, filename)

    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError("Excel file contains no data")

    raw_headers = [str(h) if h is not None else "" for h in rows[0]]
    norm_headers = [normalize_header(h) for h in raw_headers]
    _validate_headers(norm_headers)

    data_rows = rows[1:]
    if len(data_rows) > MAX_ROWS:
        raise ValueError(f"File exceeds {MAX_ROWS} data row limit")

    valid: list[dict] = []
    errors: list[dict] = []
    seen_keys: set[tuple] = set()

    for row_num, row in enumerate(data_rows, start=2):
        raw = {
            norm_headers[i]: (str(v) if v is not None else "")
            for i, v in enumerate(row)
            if i < len(norm_headers)
        }
        result, reason = _validate_row(raw, platform_map, seen_keys)
        if result is not None:
            valid.append(result)
        else:
            errors.append({"row": row_num, "reason": reason})
    return valid, errors

