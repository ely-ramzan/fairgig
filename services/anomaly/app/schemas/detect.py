from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Annotated, List

from pydantic import BaseModel, Field, field_validator

_MAX_ENTRIES = 5000

# ── Helpers ───────────────────────────────────────────────────────────────────

_DATE_FORMATS = ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]


def _parse_date_str(v: str) -> str:
    for fmt in _DATE_FORMATS:
        try:
            datetime.strptime(v.strip(), fmt)
            return v.strip()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse shift_date {v!r} — expected YYYY-MM-DD")


# ── Schemas ───────────────────────────────────────────────────────────────────

class EarningItem(BaseModel):
    shift_date: str
    platform: str
    gross_earned: Annotated[Decimal, Field(gt=Decimal("0"), max_digits=14, decimal_places=2)]
    platform_deductions: Annotated[Decimal, Field(ge=Decimal("0"), max_digits=14, decimal_places=2)]
    net_received: Annotated[Decimal, Field(gt=Decimal("0"), max_digits=14, decimal_places=2)]
    hours_worked: Annotated[Decimal, Field(gt=Decimal("0"), le=Decimal("24"), decimal_places=2)]

    @field_validator("shift_date")
    @classmethod
    def validate_shift_date(cls, v: str) -> str:
        return _parse_date_str(v)

    @field_validator("platform_deductions")
    @classmethod
    def deductions_lte_gross(cls, v: Decimal, info) -> Decimal:
        gross = info.data.get("gross_earned")
        if gross is not None and v > gross:
            raise ValueError("platform_deductions cannot exceed gross_earned")
        return v


class DetectRequest(BaseModel):
    earnings: List[EarningItem]

    @field_validator("earnings")
    @classmethod
    def check_entry_limit(cls, v: list) -> list:
        if len(v) > _MAX_ENTRIES:
            raise ValueError(
                f"Too many entries: {len(v)} submitted, maximum is {_MAX_ENTRIES}"
            )
        return v


class ExpectedRange(BaseModel):
    low: float
    high: float


class AnomalyItem(BaseModel):
    type: str
    severity: str
    shift_date: str
    platform: str
    metric: str
    expected_range: ExpectedRange
    actual_value: float
    deviation_score: float
    explanation: str


class DetectResponse(BaseModel):
    anomalies_found: int
    anomalies: List[AnomalyItem]
    summary: str
