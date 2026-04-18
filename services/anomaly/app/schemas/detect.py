from pydantic import BaseModel
from typing import List
from decimal import Decimal


class EarningItem(BaseModel):
    shift_date: str
    platform: str
    gross_earned: Decimal
    platform_deductions: Decimal
    net_received: Decimal
    hours_worked: Decimal


class DetectRequest(BaseModel):
    earnings: List[EarningItem]


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
