from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator, model_validator


# ── City Zone ────────────────────────────────────────────────────────────────

class CityZoneOut(BaseModel):
    id: uuid.UUID
    name: str
    city: str

    model_config = {"from_attributes": True}


# ── Auth Requests ─────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str
    role: str
    phone: Optional[str] = None
    city_zone_id: Optional[uuid.UUID] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ("worker", "verifier", "advocate"):
            raise ValueError("role must be worker, verifier, or advocate")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("password must be at least 8 characters")
        return v

    @model_validator(mode="after")
    def worker_requires_zone(self) -> RegisterRequest:
        if self.role == "worker" and self.city_zone_id is None:
            raise ValueError("city_zone_id is required for workers")
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Auth Responses ────────────────────────────────────────────────────────────

class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    id: uuid.UUID
    email: str
    display_name: str
    role: str
    phone: Optional[str] = None
    city_zone_id: Optional[uuid.UUID] = None
    city_zone_name: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class RegisterResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class ValidateResponse(BaseModel):
    user_id: uuid.UUID
    role: str
    city_zone_id: Optional[uuid.UUID] = None
