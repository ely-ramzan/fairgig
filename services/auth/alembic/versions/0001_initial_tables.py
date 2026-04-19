"""Initial tables — all 10 tables with indexes and constraints

Revision ID: 0001
Revises:
Create Date: 2026-04-18
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── city_zones ────────────────────────────────────────────────────────────
    op.create_table(
        "city_zones",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("city", sa.String(100), nullable=False, server_default="Lahore"),
        sa.Column("lat", sa.Numeric(10, 7)),
        sa.Column("lng", sa.Numeric(10, 7)),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
    )

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("phone", sa.String(20)),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column(
            "city_zone_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("city_zones.id"),
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "role IN ('worker', 'verifier', 'advocate')", name="ck_users_role"
        ),
    )
    op.create_index("idx_users_email", "users", ["email"])
    op.create_index("idx_users_role", "users", ["role"])
    op.create_index("idx_users_city_zone", "users", ["city_zone_id", "role"])

    # ── platforms ─────────────────────────────────────────────────────────────
    op.create_table(
        "platforms",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False, unique=True),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "category IN ('ride', 'delivery', 'freelance', 'domestic')",
            name="ck_platforms_category",
        ),
    )

    # ── file_uploads ──────────────────────────────────────────────────────────
    op.create_table(
        "file_uploads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "worker_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("cloudinary_public_id", sa.String(255), nullable=False),
        sa.Column("cloudinary_url", sa.Text, nullable=False),
        sa.Column("original_filename", sa.String(255), nullable=False),
        sa.Column("file_type", sa.String(10), nullable=False),
        sa.Column("file_size_bytes", sa.Integer),
        sa.Column("rows_imported", sa.Integer, server_default="0"),
        sa.Column("rows_skipped", sa.Integer, server_default="0"),
        sa.Column("rows_errored", sa.Integer, server_default="0"),
        sa.Column(
            "import_status", sa.String(20), nullable=False, server_default="processing"
        ),
        sa.Column("error_summary", postgresql.JSONB),
        sa.Column("uploaded_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.Column("processed_at", sa.DateTime),
        sa.CheckConstraint(
            "file_type IN ('csv', 'xlsx', 'xls')", name="ck_file_uploads_file_type"
        ),
        sa.CheckConstraint(
            "import_status IN ('processing', 'completed', 'failed')",
            name="ck_file_uploads_import_status",
        ),
    )
    op.create_index(
        "idx_file_uploads_worker",
        "file_uploads",
        ["worker_id", sa.text("uploaded_at DESC")],
    )

    # ── shift_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "shift_logs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "worker_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "platform_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("platforms.id"),
            nullable=False,
        ),
        sa.Column("shift_date", sa.Date, nullable=False),
        sa.Column("hours_worked", sa.Numeric(5, 2), nullable=False),
        sa.Column("gross_earned", sa.Numeric(12, 2), nullable=False),
        sa.Column("platform_deductions", sa.Numeric(12, 2), nullable=False),
        sa.Column("net_received", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "verification_status",
            sa.String(20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "import_source", sa.String(10), nullable=False, server_default="manual"
        ),
        sa.Column(
            "file_upload_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("file_uploads.id"),
        ),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.CheckConstraint("hours_worked > 0", name="ck_shifts_hours_positive"),
        sa.CheckConstraint("gross_earned > 0", name="ck_shifts_gross_positive"),
        sa.CheckConstraint(
            "platform_deductions >= 0", name="ck_shifts_deductions_nonneg"
        ),
        sa.CheckConstraint("net_received >= 0", name="ck_shifts_net_nonneg"),
        sa.CheckConstraint(
            "verification_status IN ('pending', 'verified', 'disputed', 'unverifiable')",
            name="ck_shifts_verification_status",
        ),
        sa.CheckConstraint(
            "import_source IN ('manual', 'csv')", name="ck_shifts_import_source"
        ),
        sa.UniqueConstraint(
            "worker_id", "platform_id", "shift_date", "gross_earned",
            name="uq_shift_entry",
        ),
    )
    op.create_index(
        "idx_shifts_worker_date", "shift_logs", ["worker_id", sa.text("shift_date DESC")]
    )
    op.create_index(
        "idx_shifts_platform_date", "shift_logs", ["platform_id", "shift_date"]
    )
    op.create_index(
        "idx_shifts_worker_platform_date",
        "shift_logs",
        ["worker_id", "platform_id", "shift_date"],
    )
    # Partial index for verifier queue — must use raw SQL
    op.execute(
        "CREATE INDEX idx_shifts_pending ON shift_logs(verification_status, created_at) "
        "WHERE verification_status = 'pending'"
    )
    # Functional index for monthly aggregation — must use raw SQL
    op.execute(
        "CREATE INDEX idx_shifts_worker_month ON shift_logs"
        "(worker_id, EXTRACT(YEAR FROM shift_date), EXTRACT(MONTH FROM shift_date))"
    )

    # ── screenshots ───────────────────────────────────────────────────────────
    op.create_table(
        "screenshots",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "shift_log_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shift_logs.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("cloudinary_public_id", sa.String(255), nullable=False),
        sa.Column("cloudinary_url", sa.Text, nullable=False),
        sa.Column("original_filename", sa.String(255)),
        sa.Column("file_size_bytes", sa.Integer),
        sa.Column("width", sa.Integer),
        sa.Column("height", sa.Integer),
        sa.Column("format", sa.String(10)),
        sa.Column("uploaded_at", sa.DateTime, server_default=sa.text("NOW()")),
    )
    op.create_index("idx_screenshots_shift", "screenshots", ["shift_log_id"])

    # ── verifications ─────────────────────────────────────────────────────────
    op.create_table(
        "verifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "shift_log_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shift_logs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "verifier_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("notes", sa.Text),
        sa.Column("verifier_gross", sa.Numeric(12, 2)),
        sa.Column("verifier_deductions", sa.Numeric(12, 2)),
        sa.Column("verified_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "status IN ('confirmed', 'disputed', 'unverifiable')",
            name="ck_verifications_status",
        ),
        sa.UniqueConstraint("shift_log_id", name="uq_verification_per_shift"),
    )
    op.create_index(
        "idx_verifications_verifier",
        "verifications",
        ["verifier_id", sa.text("verified_at DESC")],
    )
    op.create_index("idx_verifications_status", "verifications", ["status"])

    # ── grievances ────────────────────────────────────────────────────────────
    op.create_table(
        "grievances",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column(
            "worker_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "platform_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("platforms.id"),
            nullable=False,
        ),
        sa.Column("category", sa.String(30), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="open"),
        sa.Column("is_anonymous", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("resolution_notes", sa.Text),
        sa.Column("created_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.Column("updated_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "category IN ('commission_change', 'deactivation', 'payment_delay', "
            "'unfair_rating', 'safety', 'other')",
            name="ck_grievances_category",
        ),
        sa.CheckConstraint(
            "status IN ('open', 'escalated', 'resolved')", name="ck_grievances_status"
        ),
        sa.CheckConstraint(
            "char_length(description) >= 10", name="ck_grievances_description_len"
        ),
    )
    # GIN full-text index — raw SQL required
    op.execute(
        "CREATE INDEX idx_grievances_fts ON grievances "
        "USING GIN (to_tsvector('english', description))"
    )
    op.create_index(
        "idx_grievances_platform_category",
        "grievances",
        ["platform_id", "category", sa.text("created_at DESC")],
    )
    # Partial index with IN — raw SQL required
    op.execute(
        "CREATE INDEX idx_grievances_open ON grievances(status, created_at DESC) "
        "WHERE status IN ('open', 'escalated')"
    )
    op.create_index(
        "idx_grievances_cluster",
        "grievances",
        ["platform_id", "category", "created_at"],
    )

    # ── grievance_tags ────────────────────────────────────────────────────────
    op.create_table(
        "grievance_tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, default=sa.text("gen_random_uuid()")),
        sa.Column(
            "grievance_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("grievances.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tag", sa.String(50), nullable=False),
        sa.UniqueConstraint("grievance_id", "tag", name="uq_grievance_tag"),
    )
    op.create_index("idx_tags_grievance", "grievance_tags", ["grievance_id"])
    op.create_index("idx_tags_tag", "grievance_tags", ["tag"])

    # ── anomaly_results ───────────────────────────────────────────────────────
    op.create_table(
        "anomaly_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "worker_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "shift_log_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("shift_logs.id", ondelete="SET NULL"),
        ),
        sa.Column("anomaly_type", sa.String(30), nullable=False),
        sa.Column("severity", sa.String(10), nullable=False),
        sa.Column("metric_name", sa.String(50)),
        sa.Column("expected_low", sa.Numeric(12, 2)),
        sa.Column("expected_high", sa.Numeric(12, 2)),
        sa.Column("actual_value", sa.Numeric(12, 2)),
        sa.Column("deviation_score", sa.Numeric(6, 2)),
        sa.Column("explanation", sa.Text, nullable=False),
        sa.Column("detected_at", sa.DateTime, server_default=sa.text("NOW()")),
        sa.CheckConstraint(
            "anomaly_type IN ('unusual_deduction', 'income_drop', 'rate_spike', "
            "'hours_mismatch', 'mom_drop')",
            name="ck_anomaly_type",
        ),
        sa.CheckConstraint(
            "severity IN ('low', 'medium', 'high')", name="ck_anomaly_severity"
        ),
    )
    op.create_index(
        "idx_anomaly_worker",
        "anomaly_results",
        ["worker_id", sa.text("detected_at DESC")],
    )
    op.create_index(
        "idx_anomaly_severity",
        "anomaly_results",
        ["severity", sa.text("detected_at DESC")],
    )
    op.create_index("idx_anomaly_type", "anomaly_results", ["anomaly_type"])


def downgrade() -> None:
    op.drop_table("anomaly_results")
    op.drop_table("grievance_tags")
    op.drop_table("grievances")
    op.drop_table("verifications")
    op.drop_table("screenshots")
    op.drop_table("shift_logs")
    op.drop_table("file_uploads")
    op.drop_table("platforms")
    op.drop_table("users")
    op.drop_table("city_zones")
