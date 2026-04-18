import uuid
import httpx
from datetime import date, datetime

from fastapi import APIRouter, Depends, Query, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.templating import Jinja2Templates

from app.dependencies import get_current_user
from app.config import get_settings

router = APIRouter(prefix="/api/certificate", tags=["certificate"])
templates = Jinja2Templates(directory="templates")
bearer = HTTPBearer()


async def _fetch_summary(
    worker_id: str,
    token: str,
    date_from: date,
    date_to: date,
) -> dict:
    settings = get_settings()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.earnings_service_url}/api/earnings/worker/{worker_id}/summary",
            headers={"Authorization": f"Bearer {token}"},
            params={"date_from": str(date_from), "date_to": str(date_to)},
        )
    if resp.status_code != 200:
        raise HTTPException(502, "Could not fetch earnings summary from Earnings Service")
    return resp.json()


def _build_context(user: dict, summary: dict, date_from: date, date_to: date) -> dict:
    cert_id = str(uuid.uuid4())[:8].upper()
    total_hours = summary.get("total_hours", 0) or 0
    total_net = summary.get("total_net", 0) or 0
    return {
        "cert_id": cert_id,
        "generated_date": datetime.now().strftime("%Y-%m-%d"),
        "worker_name": user.get("display_name", f"Worker {user['user_id'][:8]}"),
        "date_from": str(date_from),
        "date_to": str(date_to),
        "total_gross": f"{summary.get('total_gross', 0) or 0:,.2f}",
        "total_deductions": f"{summary.get('total_deductions', 0) or 0:,.2f}",
        "total_net": f"{total_net:,.2f}",
        "total_hours": f"{total_hours:.1f}",
        "hourly_rate": f"{total_net / max(total_hours, 0.01):,.2f}",
        "shift_count": summary.get("shift_count", 0),
        "verified_count": summary.get("verified_count", 0),
        "platform_breakdown": summary.get("platform_breakdown", []),
    }


@router.get("/preview")
async def certificate_preview(
    date_from: date = Query(...),
    date_to: date = Query(...),
    user: dict = Depends(get_current_user),
    creds: HTTPAuthorizationCredentials = Depends(bearer),
):
    summary = await _fetch_summary(user["user_id"], creds.credentials, date_from, date_to)
    return _build_context(user, summary, date_from, date_to)


@router.get("/generate", response_class=HTMLResponse)
async def certificate_generate(
    request: Request,
    date_from: date = Query(...),
    date_to: date = Query(...),
    user: dict = Depends(get_current_user),
    creds: HTTPAuthorizationCredentials = Depends(bearer),
):
    summary = await _fetch_summary(user["user_id"], creds.credentials, date_from, date_to)
    context = _build_context(user, summary, date_from, date_to)
    return templates.TemplateResponse(request, "certificate.html", context)
