import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_role, bearer
from app.engine.detector import run_all_detections
from app.models import AnomalyResult
from app.schemas.detect import DetectRequest, DetectResponse
from app.config import get_settings

router = APIRouter(prefix="/api/anomaly", tags=["anomaly"])


@router.post("/detect", response_model=DetectResponse)
async def detect(body: DetectRequest):
    earnings = [e.model_dump() for e in body.earnings]
    for e in earnings:
        for k in ("gross_earned", "platform_deductions", "net_received", "hours_worked"):
            e[k] = float(e[k])

    if len(earnings) == 0:
        return DetectResponse(
            anomalies_found=0, anomalies=[], summary="No data provided"
        )
    if len(earnings) < 3:
        return DetectResponse(
            anomalies_found=0,
            anomalies=[],
            summary="Insufficient data — need at least 3 shifts",
        )

    anomalies = run_all_detections(earnings)
    return DetectResponse(
        anomalies_found=len(anomalies),
        anomalies=anomalies,
        summary=(
            f"Detected {len(anomalies)} anomalies"
            if anomalies
            else "No anomalies detected"
        ),
    )


@router.post("/analyze-worker")
async def analyze_worker(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: AsyncSession = Depends(get_db),
    user: dict = Depends(require_role("worker", "advocate", "verifier")),
):
    worker_id = user["user_id"]
    settings = get_settings()

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.earnings_service_url}/api/earnings/worker/{worker_id}/shifts-raw",
            headers={"Authorization": f"Bearer {credentials.credentials}"},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not fetch earnings data")

    earnings = resp.json()
    anomalies = run_all_detections(earnings)

    await db.execute(
        delete(AnomalyResult).where(AnomalyResult.worker_id == uuid.UUID(worker_id))
    )

    for a in anomalies:
        db.add(
            AnomalyResult(
                worker_id=uuid.UUID(worker_id),
                anomaly_type=a["type"],
                severity=a["severity"],
                metric_name=a["metric"],
                expected_low=a["expected_range"]["low"],
                expected_high=a["expected_range"]["high"],
                actual_value=a["actual_value"],
                deviation_score=a["deviation_score"],
                explanation=a["explanation"],
            )
        )

    await db.commit()
    return {"anomalies_cached": len(anomalies), "anomalies": anomalies}


@router.get("/results/{worker_id}")
async def get_results(
    worker_id: uuid.UUID,
    severity: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    _user: dict = Depends(get_current_user),
):
    stmt = select(AnomalyResult).where(
        AnomalyResult.worker_id == worker_id
    )
    if severity:
        stmt = stmt.where(AnomalyResult.severity == severity)
    stmt = stmt.order_by(AnomalyResult.detected_at.desc())

    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "id": str(r.id),
            "worker_id": str(r.worker_id),
            "anomaly_type": r.anomaly_type,
            "severity": r.severity,
            "metric_name": r.metric_name,
            "expected_low": float(r.expected_low) if r.expected_low is not None else None,
            "expected_high": float(r.expected_high) if r.expected_high is not None else None,
            "actual_value": float(r.actual_value) if r.actual_value is not None else None,
            "deviation_score": float(r.deviation_score) if r.deviation_score is not None else None,
            "explanation": r.explanation,
            "detected_at": r.detected_at.isoformat(),
        }
        for r in rows
    ]
