import logging
import traceback

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from app.routes.auth import router as auth_router

logger = logging.getLogger("auth")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="FairGig Auth Service",
    description="JWT authentication and user management for FairGig",
    version="1.0.0",
)

_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "*",
    "Access-Control-Allow-Headers": "*",
}


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
        headers=_CORS_HEADERS,
    )


@app.exception_handler(ValidationError)
async def _pydantic_handler(request: Request, exc: ValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error": "validation_error", "message": "Data validation failed", "details": _fmt_errors(exc.errors())},
        headers=_CORS_HEADERS,
    )


@app.exception_handler(HTTPException)
async def _http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    headers = {**(exc.headers or {}), **_CORS_HEADERS}
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers=headers,
    )


@app.exception_handler(Exception)
async def _generic_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled error on %s %s: %s\n%s",
        request.method,
        request.url.path,
        exc,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": "internal_server_error",
            "message": str(exc) or "An unexpected error occurred",
            "type": type(exc).__name__,
        },
        headers=_CORS_HEADERS,
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "auth"}
