from __future__ import annotations

import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String, Text, Boolean, Integer, Date, DateTime,
    Numeric, ForeignKey, CheckConstraint, UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CityZone(Base):
    __tablename__ = "city_zones"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False, server_default="Lahore")
    lat: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7))
    lng: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 7))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    users: Mapped[List["User"]] = relationship("User", back_populates="city_zone")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('worker', 'verifier', 'advocate')", name="ck_users_role"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    city_zone_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("city_zones.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    city_zone: Mapped[Optional["CityZone"]] = relationship("CityZone", back_populates="users")
    anomaly_results: Mapped[List["AnomalyResult"]] = relationship("AnomalyResult", back_populates="worker")


class AnomalyResult(Base):
    __tablename__ = "anomaly_results"
    __table_args__ = (
        CheckConstraint(
            "anomaly_type IN ('unusual_deduction', 'income_drop', 'rate_spike', "
            "'hours_mismatch', 'mom_drop')",
            name="ck_anomaly_type",
        ),
        CheckConstraint("severity IN ('low', 'medium', 'high')", name="ck_anomaly_severity"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    shift_log_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shift_logs.id", ondelete="SET NULL"), nullable=True
    )
    anomaly_type: Mapped[str] = mapped_column(String(30), nullable=False)
    severity: Mapped[str] = mapped_column(String(10), nullable=False)
    metric_name: Mapped[Optional[str]] = mapped_column(String(50))
    expected_low: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    expected_high: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    actual_value: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    deviation_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2))
    explanation: Mapped[str] = mapped_column(Text, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    worker: Mapped["User"] = relationship("User", back_populates="anomaly_results")
