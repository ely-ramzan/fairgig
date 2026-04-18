"""Reusable Pydantic annotated types shared across FairGig services."""
from __future__ import annotations

import re
import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Annotated

from pydantic import AfterValidator, Field


# ── String helpers ────────────────────────────────────────────────────────────

def _clean_str(v: str) -> str:
    """Strip surrounding whitespace; reject blank strings."""
    stripped = v.strip()
    if not stripped:
        raise ValueError("Field must not be blank or whitespace-only")
    return stripped


CleanStr = Annotated[str, AfterValidator(_clean_str)]


# ── UUID ──────────────────────────────────────────────────────────────────────

def _valid_uuid(v: str) -> str:
    try:
        uuid.UUID(v)
    except (ValueError, AttributeError):
        raise ValueError(f"Invalid UUID format: {v!r}")
    return v


UUIDStr = Annotated[str, AfterValidator(_valid_uuid)]


# ── Monetary / numeric ────────────────────────────────────────────────────────

# Positive money  e.g. gross_earned — must be > 0, max 12 integer digits
PositiveMoney = Annotated[
    Decimal,
    Field(gt=Decimal("0"), max_digits=14, decimal_places=2),
]

# Non-negative money e.g. deductions — may be 0
NonNegativeMoney = Annotated[
    Decimal,
    Field(ge=Decimal("0"), max_digits=14, decimal_places=2),
]

# Hours worked: > 0 and ≤ 24 per shift
HoursWorked = Annotated[
    Decimal,
    Field(gt=Decimal("0"), le=Decimal("24"), decimal_places=2),
]


# ── Date ──────────────────────────────────────────────────────────────────────

def _not_future(v: date) -> date:
    if v > date.today():
        raise ValueError(f"shift_date {v} cannot be in the future")
    return v


ShiftDate = Annotated[date, AfterValidator(_not_future)]


def _validate_date_str(v: str) -> str:
    """Validate that a string is a parseable date (YYYY-MM-DD preferred)."""
    formats = ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]
    for fmt in formats:
        try:
            datetime.strptime(v.strip(), fmt)
            return v.strip()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: {v!r} — expected YYYY-MM-DD")


ValidDateStr = Annotated[str, AfterValidator(_validate_date_str)]


# ── Pagination ────────────────────────────────────────────────────────────────

PageNumber = Annotated[int, Field(ge=1, default=1)]
PageLimit = Annotated[int, Field(ge=1, le=200, default=50)]
