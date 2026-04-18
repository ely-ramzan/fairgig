from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator


# ── Annotated types (inline — avoids shared/ import complexity) ───────────────

def _not_future(v: date) -> date:
    from datetime import date as _date
    if v > _date.today():
        raise ValueError(f"shift_date {v} cannot be in the future")
    return v


_PositiveMoney = Annotated[Decimal, Field(gt=Decimal("0"), max_digits=14, decimal_places=2)]
_NonNegMoney   = Annotated[Decimal, Field(ge=Decimal("0"), max_digits=14, decimal_places=2)]
_HoursWorked   = Annotated[Decimal, Field(gt=Decimal("0"), le=Decimal("24"), decimal_places=2)]


# ── Schemas ───────────────────────────────────────────────────────────────────

class ShiftCreate(BaseModel):
    platform_id: str
    shift_date: date
    hours_worked: _HoursWorked
    gross_earned: _PositiveMoney
    platform_deductions: _NonNegMoney
    net_received: _PositiveMoney

    @field_validator("platform_id")
    @classmethod
    def validate_platform_uuid(cls, v: str) -> str:
        try:
            uuid.UUID(v)
        except (ValueError, AttributeError):
            raise ValueError(f"platform_id must be a valid UUID, got {v!r}")
        return v

    @field_validator("shift_date")
    @classmethod
    def validate_shift_date(cls, v: date) -> date:
        return _not_future(v)

    @field_validator("platform_deductions")
    @classmethod
    def deductions_lte_gross(cls, v: Decimal, info) -> Decimal:
        gross = info.data.get("gross_earned")
        if gross is not None and v > gross:
            raise ValueError("platform_deductions cannot exceed gross_earned")
        return v

    @field_validator("net_received")
    @classmethod
    def validate_net(cls, v: Decimal, info) -> Decimal:
        data = info.data
        if "gross_earned" in data and "platform_deductions" in data:
            expected = data["gross_earned"] - data["platform_deductions"]
            if expected > 0:
                tolerance = expected * Decimal("0.02")
                if abs(v - expected) > tolerance:
                    raise ValueError(
                        f"net_received must be within 2% of (gross - deductions)"
                        f" — expected ~{expected:.2f}, got {v}"
                    )
        return v


class VerifyRequest(BaseModel):
    status: Literal["verified", "disputed", "unverifiable"]
    notes: Optional[str] = None
    verifier_gross: Optional[_PositiveMoney] = None
    verifier_deductions: Optional[_NonNegMoney] = None


class ShiftListParams(BaseModel):
    page:       Annotated[int, Field(ge=1, default=1)]
    limit:      Annotated[int, Field(ge=1, le=200, default=50)]
    date_from:  Optional[date] = None
    date_to:    Optional[date] = None
    platform_id: Optional[str] = None
    sort:       Literal["shift_date", "gross_earned", "hours_worked"] = "shift_date"
    order:      Literal["asc", "desc"] = "desc"

    @model_validator(mode="after")
    def date_range_check(self) -> ShiftListParams:
        if self.date_from and self.date_to and self.date_from > self.date_to:
            raise ValueError("date_from must not be later than date_to")
        return self
