from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.routes.commission import router as commission_router
from app.routes.income import router as income_router
from app.routes.vulnerability import router as vulnerability_router
from app.routes.comparison import router as comparison_router
from app.routes.dashboard import router as dashboard_router

app = FastAPI(title="FairGig Analytics Service", version="1.0.0")


def _fmt_errors(errors: list) -> list[dict]:
    return [
        {
            "field": " → ".join(str(loc) for loc in e.get("loc", [])),
            "message": e.get("msg", "Validation error"),
        }
        for e in errors
    ]


@app.exception_handler(RequestValidationError)
async def _validation_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "validation_error", "message": "Request validation failed", "details": _fmt_errors(exc.errors())},
    )


@app.exception_handler(ValidationError)
async def _pydantic_handler(request: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "validation_error", "message": "Data validation failed", "details": _fmt_errors(exc.errors())},
    )


@app.exception_handler(Exception)
async def _generic_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "internal_server_error", "message": "An unexpected error occurred", "details": []},
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(commission_router)
app.include_router(income_router)
app.include_router(vulnerability_router)
app.include_router(comparison_router)
app.include_router(dashboard_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics"}
