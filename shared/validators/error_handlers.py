"""Standardised FastAPI exception handlers for all FairGig services.

Usage in main.py:
    from shared.validators.error_handlers import register_exception_handlers
    register_exception_handlers(app)
"""
from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import ValidationError


def _fmt_pydantic_errors(errors: list) -> list[dict]:
    return [
        {
            "field": " → ".join(str(loc) for loc in err.get("loc", [])),
            "message": err.get("msg", "Validation error"),
        }
        for err in errors
    ]


def register_exception_handlers(app: FastAPI) -> None:
    """Attach standardised error handlers to a FastAPI app."""

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "validation_error",
                "message": "Request body or parameters failed validation",
                "details": _fmt_pydantic_errors(exc.errors()),
            },
        )

    @app.exception_handler(ValidationError)
    async def pydantic_exception_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error": "validation_error",
                "message": "Data validation failed",
                "details": _fmt_pydantic_errors(exc.errors()),
            },
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(
        request: Request, exc: Exception
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "internal_server_error",
                "message": "An unexpected error occurred",
                "details": [],
            },
        )
