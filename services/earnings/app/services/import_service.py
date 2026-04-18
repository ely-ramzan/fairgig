"""CSV / Excel import helpers for shift logs."""
import csv
import io
from datetime import date
from decimal import Decimal, InvalidOperation

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


def normalize_header(raw: str) -> str:
    key = raw.strip().lower()
    return HEADER_ALIASES.get(key, key)


def parse_date(value: str) -> date:
    from datetime import datetime
    s = value.strip()
    if not s:
        raise ValueError(f"Empty date string")
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {value!r}")


def _validate_row(row: dict, platform_map: dict[str, str]) -> tuple[dict | None, str | None]:
    platform_key = row.get("platform", "").strip().lower()
    platform_id = platform_map.get(platform_key)
    if platform_id is None:
        return None, f"Unknown platform: {row.get('platform')!r}"

    try:
        shift_date = parse_date(row["shift_date"])
    except (ValueError, KeyError) as e:
        return None, f"Bad shift_date: {e}"

    try:
        gross = Decimal(str(row["gross_earned"]))
        deductions = Decimal(str(row["platform_deductions"]))
        net = Decimal(str(row["net_received"]))
        hours = Decimal(str(row["hours_worked"]))
    except (InvalidOperation, KeyError) as e:
        return None, f"Bad numeric field: {e}"

    expected = gross - deductions
    if expected > 0:
        tolerance = expected * Decimal("0.02")
        if abs(net - expected) > tolerance:
            return None, (
                f"net_received {net} is outside 2% tolerance "
                f"(expected ~{expected})"
            )

    return {
        "platform_id": platform_id,
        "shift_date": shift_date,
        "gross_earned": gross,
        "platform_deductions": deductions,
        "net_received": net,
        "hours_worked": hours,
    }, None


def _detect_delimiter(header_line: str) -> str:
    return ";" if ";" in header_line else ","


def parse_csv(
    file_bytes: bytes,
    platform_map: dict[str, str],
) -> tuple[list[dict], list[dict]]:
    text = file_bytes.decode("utf-8-sig")
    lines = text.splitlines()
    if not lines:
        return [], []

    delimiter = _detect_delimiter(lines[0])
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    reader.fieldnames = [normalize_header(h) for h in (reader.fieldnames or [])]

    valid, errors = [], []
    for row_num, row in enumerate(reader, start=2):
        normalized = {normalize_header(k): v for k, v in row.items()}
        result, reason = _validate_row(normalized, platform_map)
        if result is not None:
            valid.append(result)
        else:
            errors.append({"row": row_num, "reason": reason})
    return valid, errors


def parse_excel(
    file_bytes: bytes,
    platform_map: dict[str, str],
) -> tuple[list[dict], list[dict]]:
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], []

    headers = [normalize_header(str(h)) if h is not None else "" for h in rows[0]]

    valid, errors = [], []
    for row_num, row in enumerate(rows[1:], start=2):
        raw = {headers[i]: (str(v) if v is not None else "") for i, v in enumerate(row)}
        result, reason = _validate_row(raw, platform_map)
        if result is not None:
            valid.append(result)
        else:
            errors.append({"row": row_num, "reason": reason})
    return valid, errors
