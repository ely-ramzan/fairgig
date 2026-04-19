from __future__ import annotations

import uuid
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import (
    String, Text, Boolean, Integer, Date, DateTime,
    Numeric, ForeignKey, CheckConstraint, UniqueConstraint,
    func, UUID as SA_UUID,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CityZone(Base):
    __tablename__ = "city_zones"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
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

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    city_zone_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("city_zones.id")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    city_zone: Mapped[Optional["CityZone"]] = relationship("CityZone", back_populates="users")
    shift_logs: Mapped[List["ShiftLog"]] = relationship(
        "ShiftLog", back_populates="worker", foreign_keys="ShiftLog.worker_id"
    )
    file_uploads: Mapped[List["FileUpload"]] = relationship("FileUpload", back_populates="worker")
    verifications: Mapped[List["Verification"]] = relationship(
        "Verification", back_populates="verifier"
    )
    grievances: Mapped[List["Grievance"]] = relationship("Grievance", back_populates="worker")
    anomaly_results: Mapped[List["AnomalyResult"]] = relationship(
        "AnomalyResult", back_populates="worker"
    )


class Platform(Base):
    __tablename__ = "platforms"
    __table_args__ = (
        CheckConstraint(
            "category IN ('ride', 'delivery', 'freelance', 'domestic')",
            name="ck_platforms_category",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    shift_logs: Mapped[List["ShiftLog"]] = relationship("ShiftLog", back_populates="platform")
    grievances: Mapped[List["Grievance"]] = relationship("Grievance", back_populates="platform")


class FileUpload(Base):
    __tablename__ = "file_uploads"
    __table_args__ = (
        CheckConstraint(
            "file_type IN ('csv', 'xlsx', 'xls')", name="ck_file_uploads_file_type"
        ),
        CheckConstraint(
            "import_status IN ('processing', 'completed', 'failed')",
            name="ck_file_uploads_import_status",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    cloudinary_public_id: Mapped[str] = mapped_column(String(255), nullable=False)
    cloudinary_url: Mapped[str] = mapped_column(Text, nullable=False)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(10), nullable=False)
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    rows_imported: Mapped[int] = mapped_column(Integer, server_default="0")
    rows_skipped: Mapped[int] = mapped_column(Integer, server_default="0")
    rows_errored: Mapped[int] = mapped_column(Integer, server_default="0")
    import_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="processing"
    )
    error_summary: Mapped[Optional[dict]] = mapped_column(JSONB)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

    worker: Mapped["User"] = relationship("User", back_populates="file_uploads")
    shift_logs: Mapped[List["ShiftLog"]] = relationship(
        "ShiftLog", back_populates="file_upload"
    )


class ShiftLog(Base):
    __tablename__ = "shift_logs"
    __table_args__ = (
        CheckConstraint("hours_worked > 0", name="ck_shifts_hours_positive"),
        CheckConstraint("gross_earned > 0", name="ck_shifts_gross_positive"),
        CheckConstraint("platform_deductions >= 0", name="ck_shifts_deductions_nonneg"),
        CheckConstraint("net_received >= 0", name="ck_shifts_net_nonneg"),
        CheckConstraint(
            "verification_status IN ('pending', 'verified', 'disputed', 'unverifiable')",
            name="ck_shifts_verification_status",
        ),
        CheckConstraint(
            "import_source IN ('manual', 'csv')", name="ck_shifts_import_source"
        ),
        UniqueConstraint(
            "worker_id", "platform_id", "shift_date", "gross_earned",
            name="uq_shift_entry",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    platform_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("platforms.id"), nullable=False
    )
    shift_date: Mapped[date] = mapped_column(Date, nullable=False)
    hours_worked: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    gross_earned: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    platform_deductions: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    net_received: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    verification_status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default="pending"
    )
    import_source: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="manual"
    )
    file_upload_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("file_uploads.id")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    worker: Mapped["User"] = relationship(
        "User", back_populates="shift_logs", foreign_keys=[worker_id]
    )
    platform: Mapped["Platform"] = relationship("Platform", back_populates="shift_logs")
    file_upload: Mapped[Optional["FileUpload"]] = relationship(
        "FileUpload", back_populates="shift_logs"
    )
    screenshot: Mapped[Optional["Screenshot"]] = relationship(
        "Screenshot", back_populates="shift_log", uselist=False
    )
    verification: Mapped[Optional["Verification"]] = relationship(
        "Verification", back_populates="shift_log", uselist=False
    )
    anomaly_results: Mapped[List["AnomalyResult"]] = relationship(
        "AnomalyResult", back_populates="shift_log"
    )


class Screenshot(Base):
    __tablename__ = "screenshots"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    shift_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("shift_logs.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    cloudinary_public_id: Mapped[str] = mapped_column(String(255), nullable=False)
    cloudinary_url: Mapped[str] = mapped_column(Text, nullable=False)
    original_filename: Mapped[Optional[str]] = mapped_column(String(255))
    file_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    width: Mapped[Optional[int]] = mapped_column(Integer)
    height: Mapped[Optional[int]] = mapped_column(Integer)
    format: Mapped[Optional[str]] = mapped_column(String(10))
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    shift_log: Mapped["ShiftLog"] = relationship("ShiftLog", back_populates="screenshot")


class Verification(Base):
    __tablename__ = "verifications"
    __table_args__ = (
        CheckConstraint(
            "status IN ('verified', 'disputed', 'unverifiable')",
            name="ck_verifications_status",
        ),
        UniqueConstraint("shift_log_id", name="uq_verification_per_shift"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    shift_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shift_logs.id", ondelete="CASCADE"), nullable=False
    )
    verifier_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    verifier_gross: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    verifier_deductions: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    verified_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    shift_log: Mapped["ShiftLog"] = relationship("ShiftLog", back_populates="verification")
    verifier: Mapped["User"] = relationship("User", back_populates="verifications")


class Grievance(Base):
    __tablename__ = "grievances"
    __table_args__ = (
        CheckConstraint(
            "category IN ('commission_change', 'deactivation', 'payment_delay', "
            "'unfair_rating', 'safety', 'other')",
            name="ck_grievances_category",
        ),
        CheckConstraint(
            "status IN ('open', 'escalated', 'resolved')", name="ck_grievances_status"
        ),
        CheckConstraint("char_length(description) >= 10", name="ck_grievances_description_len"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    platform_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("platforms.id"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(30), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="open")
    is_anonymous: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    resolution_notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    worker: Mapped["User"] = relationship("User", back_populates="grievances")
    platform: Mapped["Platform"] = relationship("Platform", back_populates="grievances")
    tags: Mapped[List["GrievanceTag"]] = relationship(
        "GrievanceTag", back_populates="grievance", cascade="all, delete-orphan"
    )


class GrievanceTag(Base):
    __tablename__ = "grievance_tags"
    __table_args__ = (
        UniqueConstraint("grievance_id", "tag", name="uq_grievance_tag"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    grievance_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("grievances.id", ondelete="CASCADE"), nullable=False
    )
    tag: Mapped[str] = mapped_column(String(50), nullable=False)

    grievance: Mapped["Grievance"] = relationship("Grievance", back_populates="tags")


class AnomalyResult(Base):
    __tablename__ = "anomaly_results"
    __table_args__ = (
        CheckConstraint(
            "anomaly_type IN ('unusual_deduction', 'income_drop', 'rate_spike', "
            "'hours_mismatch', 'mom_drop')",
            name="ck_anomaly_type",
        ),
        CheckConstraint(
            "severity IN ('low', 'medium', 'high')", name="ck_anomaly_severity"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    worker_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    shift_log_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shift_logs.id", ondelete="SET NULL")
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
    shift_log: Mapped[Optional["ShiftLog"]] = relationship(
        "ShiftLog", back_populates="anomaly_results"
    )
