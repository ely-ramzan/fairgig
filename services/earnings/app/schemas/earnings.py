from pydantic import BaseModel, field_validator
from decimal import Decimal
from datetime import date
from typing import Optional


class ShiftCreate(BaseModel):
    platform_id: str
    shift_date: date
    hours_worked: Decimal
    gross_earned: Decimal
    platform_deductions: Decimal
    net_received: Decimal

    @field_validator("net_received")
    @classmethod
    def validate_net(cls, v, info):
        data = info.data
        if "gross_earned" in data and "platform_deductions" in data:
            expected = data["gross_earned"] - data["platform_deductions"]
            if expected > 0:
                tolerance = expected * Decimal("0.02")
                if abs(v - expected) > tolerance:
                    raise ValueError(
                        f"net_received must be within 2% of gross - deductions"
                        f" (expected ~{expected}, got {v})"
                    )
        return v


class VerifyRequest(BaseModel):
    status: str
    notes: Optional[str] = None
    verifier_gross: Optional[Decimal] = None
    verifier_deductions: Optional[Decimal] = None
