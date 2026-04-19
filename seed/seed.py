"""
FairGig Seed Script
===================
Populates the database with realistic demo data.

Usage:
    cd seed
    python seed.py

Requirements:
    pip install -r requirements.txt

The script is idempotent — it truncates all tables first, then re-inserts.
"""
from __future__ import annotations

import json
import os
import random
import sys
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import bcrypt
from dotenv import load_dotenv
from faker import Faker
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session, sessionmaker

# ── Bootstrap ─────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

# Seed uses sync psycopg2 driver — replace asyncpg prefix if present
_raw_url = os.environ.get(
    "DATABASE_URL", "postgresql://postgres:password@localhost:5432/fairgig"
)
DATABASE_URL = _raw_url.replace("postgresql+asyncpg://", "postgresql://")

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(bind=engine)

fake = Faker()
random.seed(42)
Faker.seed(42)

DEFAULT_PASSWORD = "Secure@123"
_hashed_default = bcrypt.hashpw(DEFAULT_PASSWORD.encode(), bcrypt.gensalt(rounds=12)).decode()

# ── Helpers ───────────────────────────────────────────────────────────────────

def new_id() -> uuid.UUID:
    return uuid.uuid4()


def pk() -> str:
    return str(new_id())


def _w(d: date) -> int:
    """ISO week number (1-52) within the 3-month period."""
    return d.isocalendar()[1]


def commission_rate(platform_name: str, shift_dt: date) -> float:
    """
    Careem: 20-25% normally, spikes to 30% in calendar week 8 (the anomaly trigger).
    Others: fixed realistic ranges.
    """
    week = shift_dt.isocalendar()[1]
    if platform_name == "Careem":
        if week == 8:
            return random.uniform(0.28, 0.32)
        return random.uniform(0.20, 0.25)
    if platform_name == "Foodpanda":
        return random.uniform(0.22, 0.28)
    if platform_name == "Uber":
        return random.uniform(0.20, 0.25)
    if platform_name == "InDriver":
        return random.uniform(0.10, 0.18)
    if platform_name == "Fiverr":
        return random.uniform(0.20, 0.20)  # Fiverr is flat 20%
    return random.uniform(0.20, 0.25)


def zone_income_multiplier(zone_name: str) -> float:
    """DHA earns ~15% more than Johar Town as baseline."""
    multipliers = {
        "DHA": 1.15,
        "Gulberg": 1.10,
        "Cantt": 1.08,
        "Model Town": 1.03,
        "Bahria Town": 0.98,
        "Johar Town": 1.00,
    }
    return multipliers.get(zone_name, 1.0)


def gross_for_shift(platform_name: str, zone_name: str, hours: float) -> float:
    """Realistic gross earnings per hour by platform."""
    base_per_hour = {
        "Careem": random.uniform(350, 500),
        "Uber": random.uniform(320, 480),
        "InDriver": random.uniform(280, 420),
        "Foodpanda": random.uniform(200, 320),
        "Fiverr": random.uniform(400, 1200),
    }.get(platform_name, 350)
    multiplier = zone_income_multiplier(zone_name)
    return round(base_per_hour * hours * multiplier, 2)


# ── Truncate ──────────────────────────────────────────────────────────────────

TABLES_IN_ORDER = [
    "anomaly_results",
    "grievance_tags",
    "grievances",
    "verifications",
    "screenshots",
    "shift_logs",
    "file_uploads",
    "users",
    "platforms",
    "city_zones",
]


def truncate_all(session: Session) -> None:
    print("Truncating existing data...")
    # Disable triggers (including FK checks) during truncation
    for table in TABLES_IN_ORDER:
        session.execute(text(f"TRUNCATE TABLE {table} RESTART IDENTITY CASCADE"))
    session.commit()
    print("  Truncated. ✓")


# ── Seed functions ────────────────────────────────────────────────────────────

def seed_city_zones(session: Session) -> list[dict]:
    print("Seeding city zones...", end=" ", flush=True)
    data_path = Path(__file__).parent / "data" / "zones.json"
    zones_raw = json.loads(data_path.read_text())
    zones = []
    for z in zones_raw:
        row = {
            "id": pk(),
            "name": z["name"],
            "city": z["city"],
            "lat": Decimal(str(z["lat"])),
            "lng": Decimal(str(z["lng"])),
            "created_at": datetime.utcnow(),
        }
        zones.append(row)
        session.execute(
            text(
                "INSERT INTO city_zones (id, name, city, lat, lng, created_at) "
                "VALUES (:id, :name, :city, :lat, :lng, :created_at)"
            ),
            row,
        )
    session.commit()
    print(f"✓  ({len(zones)} zones)")
    return zones


def seed_platforms(session: Session) -> list[dict]:
    print("Seeding platforms...", end=" ", flush=True)
    data_path = Path(__file__).parent / "data" / "platforms.json"
    platforms_raw = json.loads(data_path.read_text())
    platforms = []
    for p in platforms_raw:
        row = {
            "id": pk(),
            "name": p["name"],
            "category": p["category"],
            "created_at": datetime.utcnow(),
        }
        platforms.append(row)
        session.execute(
            text(
                "INSERT INTO platforms (id, name, category, created_at) "
                "VALUES (:id, :name, :category, :created_at)"
            ),
            row,
        )
    session.commit()
    print(f"✓  ({len(platforms)} platforms)")
    return platforms


def seed_users(session: Session, zones: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    """Returns (workers, verifiers, advocates)."""
    print("Seeding users...", end=" ", flush=True)

    zone_ids = [z["id"] for z in zones]
    used_emails: set[str] = set()

    def make_user(role: str, zone_id: str | None = None) -> dict:
        while True:
            email = fake.unique.email()
            if email not in used_emails:
                used_emails.add(email)
                break
        return {
            "id": pk(),
            "email": email,
            "phone": f"+92{random.randint(300, 349)}{random.randint(1000000, 9999999)}",
            "password_hash": _hashed_default,
            "role": role,
            "display_name": fake.name(),
            "city_zone_id": zone_id,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }

    workers: list[dict] = []
    for _ in range(210):
        zone_id = random.choice(zone_ids)
        workers.append(make_user("worker", zone_id))

    verifiers: list[dict] = []
    for _ in range(10):
        verifiers.append(make_user("verifier"))

    advocates: list[dict] = []
    for _ in range(5):
        advocates.append(make_user("advocate"))

    all_users = workers + verifiers + advocates
    for u in all_users:
        session.execute(
            text(
                "INSERT INTO users "
                "(id, email, phone, password_hash, role, display_name, city_zone_id, created_at, updated_at) "
                "VALUES (:id, :email, :phone, :password_hash, :role, :display_name, "
                ":city_zone_id, :created_at, :updated_at)"
            ),
            u,
        )
    session.commit()
    print(f"✓  ({len(workers)} workers, {len(verifiers)} verifiers, {len(advocates)} advocates)")
    return workers, verifiers, advocates


def seed_file_uploads(session: Session, workers: list[dict]) -> list[dict]:
    """Seed 12 sample CSV file upload records."""
    print("Seeding file uploads...", end=" ", flush=True)
    uploads: list[dict] = []
    sample_workers = random.sample(workers, 12)
    for w in sample_workers:
        upload_id = pk()
        row = {
            "id": upload_id,
            "worker_id": w["id"],
            "cloudinary_public_id": f"fairgig/imports/{w['id']}/{upload_id}",
            "cloudinary_url": f"https://res.cloudinary.com/fairgig/raw/upload/v1/fairgig/imports/{w['id']}/{upload_id}.csv",
            "original_filename": f"earnings_{fake.date_this_year().strftime('%B').lower()}.csv",
            "file_type": "csv",
            "file_size_bytes": random.randint(4096, 51200),
            "rows_imported": random.randint(20, 60),
            "rows_skipped": random.randint(0, 3),
            "rows_errored": 0,
            "import_status": "completed",
            "error_summary": None,
            "uploaded_at": datetime.utcnow() - timedelta(days=random.randint(1, 60)),
            "processed_at": datetime.utcnow() - timedelta(days=random.randint(0, 1)),
        }
        uploads.append(row)
        session.execute(
            text(
                "INSERT INTO file_uploads "
                "(id, worker_id, cloudinary_public_id, cloudinary_url, original_filename, "
                "file_type, file_size_bytes, rows_imported, rows_skipped, rows_errored, "
                "import_status, error_summary, uploaded_at, processed_at) "
                "VALUES (:id, :worker_id, :cloudinary_public_id, :cloudinary_url, "
                ":original_filename, :file_type, :file_size_bytes, :rows_imported, "
                ":rows_skipped, :rows_errored, :import_status, :error_summary, "
                ":uploaded_at, :processed_at)"
            ),
            row,
        )
    session.commit()
    print(f"✓  ({len(uploads)} uploads)")
    return uploads


def seed_shift_logs(
    session: Session,
    workers: list[dict],
    platforms: list[dict],
    zones: list[dict],
) -> list[dict]:
    """
    Generates ~8,000 shifts over 3 months with realistic distributions:
    - Variable shift frequency (daily workers vs weekly workers)
    - Commission spike in week 8 for Careem
    - DHA earns ~15% more than Johar Town
    - 5 designated workers get a >20% income drop in month 3
    """
    print("Seeding shift logs...", end=" ", flush=True)

    zone_by_id = {z["id"]: z for z in zones}
    platform_by_id = {p["id"]: p for p in platforms}
    platform_by_name = {p["name"]: p for p in platforms}

    # 3-month window: Jan–Mar 2026
    start_date = date(2026, 1, 1)
    end_date = date(2026, 3, 31)
    date_range = [start_date + timedelta(days=i) for i in range((end_date - start_date).days + 1)]

    # Pick 5 workers who will have income drops in month 3
    drop_workers = set(w["id"] for w in random.sample(workers, 5))

    # Assign each worker a frequency profile and a primary platform
    worker_profiles: dict[str, dict] = {}
    for w in workers:
        zone = zone_by_id.get(w["city_zone_id"], {})
        zone_name = zone.get("name", "Gulberg")
        # Freelance workers (Fiverr) or mixed
        pref_platform = random.choices(platforms, weights=[30, 20, 20, 15, 15])[0]
        worker_profiles[w["id"]] = {
            "zone_name": zone_name,
            "preferred_platform": pref_platform,
            "frequency": random.choices(["daily", "semi", "weekly"], weights=[40, 35, 25])[0],
        }

    shifts: list[dict] = []
    seen_entries: set[tuple] = set()  # (worker_id, platform_id, shift_date, gross_earned)

    for w in workers:
        profile = worker_profiles[w["id"]]
        freq = profile["frequency"]
        zone_name = profile["zone_name"]
        pref_platform = profile["preferred_platform"]

        for d in date_range:
            # Decide if worker works this day
            if freq == "daily":
                work_prob = 0.85
            elif freq == "semi":
                work_prob = 0.50
            else:  # weekly
                work_prob = 0.20

            if random.random() > work_prob:
                continue

            # 80% of the time use preferred platform, 20% use another
            if random.random() < 0.80:
                platform = pref_platform
            else:
                platform = random.choice(platforms)

            platform_name = platform["name"]

            # Income drop in month 3 for designated workers
            drop_multiplier = 1.0
            if w["id"] in drop_workers and d.month == 3:
                drop_multiplier = random.uniform(0.60, 0.75)  # >20% drop

            hours = round(random.uniform(2.0, 10.0), 2)
            gross = gross_for_shift(platform_name, zone_name, hours) * drop_multiplier
            gross = round(gross, 2)
            rate = commission_rate(platform_name, d)
            deductions = round(gross * rate, 2)
            net = round(max(gross - deductions, 0), 2)

            entry_key = (w["id"], platform["id"], d.isoformat(), str(gross))
            if entry_key in seen_entries:
                # Adjust gross slightly to avoid unique constraint violation
                gross = round(gross + random.uniform(0.01, 0.50), 2)
                deductions = round(gross * rate, 2)
                net = round(max(gross - deductions, 0), 2)
                entry_key = (w["id"], platform["id"], d.isoformat(), str(gross))

            seen_entries.add(entry_key)
            shifts.append({
                "id": pk(),
                "worker_id": w["id"],
                "platform_id": platform["id"],
                "shift_date": d,
                "hours_worked": Decimal(str(hours)),
                "gross_earned": Decimal(str(gross)),
                "platform_deductions": Decimal(str(deductions)),
                "net_received": Decimal(str(net)),
                "verification_status": "pending",
                "import_source": "manual",
                "file_upload_id": None,
                "created_at": datetime.combine(d, datetime.min.time()),
            })

    # Batch insert in chunks of 500
    total = len(shifts)
    for i in range(0, total, 500):
        chunk = shifts[i : i + 500]
        session.execute(
            text(
                "INSERT INTO shift_logs "
                "(id, worker_id, platform_id, shift_date, hours_worked, gross_earned, "
                "platform_deductions, net_received, verification_status, import_source, "
                "file_upload_id, created_at) "
                "VALUES (:id, :worker_id, :platform_id, :shift_date, :hours_worked, "
                ":gross_earned, :platform_deductions, :net_received, :verification_status, "
                ":import_source, :file_upload_id, :created_at)"
            ),
            chunk,
        )
        session.commit()

    print(f"✓  ({total:,} shift logs)")
    return shifts


def seed_screenshots(session: Session, shifts: list[dict]) -> list[dict]:
    """Generate ~3,000 screenshot records (fake Cloudinary URLs)."""
    print("Seeding screenshots...", end=" ", flush=True)

    # ~65% of shifts have screenshots — higher coverage so the verification
    # pipeline has enough eligible shifts to produce ~4,000 verified records,
    # which gives the zone_earnings_summary view enough data per cell to satisfy
    # the HAVING COUNT(DISTINCT worker_id) >= 5 k-anonymity threshold.
    sample_shifts = random.sample(shifts, min(5500, int(len(shifts) * 0.65)))
    screenshots: list[dict] = []

    for shift in sample_shifts:
        worker_id = shift["worker_id"]
        shift_id = shift["id"]
        row = {
            "id": pk(),
            "shift_log_id": shift_id,
            "cloudinary_public_id": f"fairgig/screenshots/{worker_id}/{shift_id}",
            "cloudinary_url": (
                f"https://res.cloudinary.com/fairgig/image/upload/v1/"
                f"fairgig/screenshots/{worker_id}/{shift_id}.jpg"
            ),
            "original_filename": f"screenshot_{shift['shift_date']}.jpg",
            "file_size_bytes": random.randint(102400, 2097152),
            "width": random.choice([1080, 1280, 1440]),
            "height": random.choice([1920, 2340, 3040]),
            "format": "jpg",
            "uploaded_at": shift["created_at"] + timedelta(hours=random.randint(1, 6)),
        }
        screenshots.append(row)

    for i in range(0, len(screenshots), 500):
        chunk = screenshots[i : i + 500]
        session.execute(
            text(
                "INSERT INTO screenshots "
                "(id, shift_log_id, cloudinary_public_id, cloudinary_url, original_filename, "
                "file_size_bytes, width, height, format, uploaded_at) "
                "VALUES (:id, :shift_log_id, :cloudinary_public_id, :cloudinary_url, "
                ":original_filename, :file_size_bytes, :width, :height, :format, :uploaded_at)"
            ),
            chunk,
        )
        session.commit()

    print(f"✓  ({len(screenshots):,} screenshots)")
    return screenshots


def seed_verifications(
    session: Session,
    shifts: list[dict],
    verifiers: list[dict],
    screenshots: list[dict],
) -> None:
    """
    ~5,000 verifications from shifts that have screenshots:
    - 60% confirmed  → ~4,000 shifts get verification_status='verified'
    - 10% disputed   → ~667  shifts get verification_status='disputed'
    - rest unverifiable
    Using a 5,000-sample ensures enough verified shifts per zone+platform+week
    cell to consistently satisfy HAVING COUNT(DISTINCT worker_id) >= 5.
    """
    print("Seeding verifications...", end=" ", flush=True)

    screenshot_shift_ids = {s["shift_log_id"] for s in screenshots}
    eligible_shifts = [s for s in shifts if s["id"] in screenshot_shift_ids]

    # Sample up to 5,000 eligible shifts
    sample_size = min(5000, len(eligible_shifts))
    sample_shifts = random.sample(eligible_shifts, sample_size)

    # 60% confirmed, 10% disputed, 30% unverifiable
    n_confirmed = int(sample_size * 0.60)
    n_disputed = int(sample_size * 0.10)
    n_unverifiable = sample_size - n_confirmed - n_disputed

    status_list = (
        ["confirmed"] * n_confirmed
        + ["disputed"] * n_disputed
        + ["unverifiable"] * n_unverifiable
    )
    random.shuffle(status_list)

    verifications: list[dict] = []
    shift_status_map: dict[str, str] = {}

    for shift, vstatus in zip(sample_shifts, status_list):
        verifier = random.choice(verifiers)
        gross = float(shift["gross_earned"])
        deductions = float(shift["platform_deductions"])

        verifier_gross = None
        verifier_deductions = None
        notes = None

        if vstatus == "disputed":
            # Verifier reads slightly different values
            verifier_gross = round(gross * random.uniform(0.85, 0.98), 2)
            verifier_deductions = round(deductions * random.uniform(0.90, 1.10), 2)
            notes = random.choice([
                "Screenshot shows different gross amount than claimed.",
                "Deductions do not match platform receipt in screenshot.",
                "Earnings appear inflated compared to visible trip data.",
            ])
        elif vstatus == "unverifiable":
            notes = random.choice([
                "Screenshot is blurry and unreadable.",
                "Screenshot does not show earnings summary page.",
                "Image appears to be from a different date.",
            ])

        verified_at = shift["created_at"] + timedelta(
            hours=random.randint(2, 72)
        )
        row = {
            "id": pk(),
            "shift_log_id": shift["id"],
            "verifier_id": verifier["id"],
            "status": vstatus,
            "notes": notes,
            "verifier_gross": Decimal(str(verifier_gross)) if verifier_gross else None,
            "verifier_deductions": (
                Decimal(str(verifier_deductions)) if verifier_deductions else None
            ),
            "verified_at": verified_at,
        }
        verifications.append(row)
        shift_status_map[shift["id"]] = (
            "verified" if vstatus == "confirmed" else vstatus
        )

    # Update shift verification_status
    for shift_id, new_status in shift_status_map.items():
        session.execute(
            text(
                "UPDATE shift_logs SET verification_status = :status WHERE id = :id"
            ),
            {"status": new_status, "id": shift_id},
        )

    for i in range(0, len(verifications), 500):
        chunk = verifications[i : i + 500]
        session.execute(
            text(
                "INSERT INTO verifications "
                "(id, shift_log_id, verifier_id, status, notes, verifier_gross, "
                "verifier_deductions, verified_at) "
                "VALUES (:id, :shift_log_id, :verifier_id, :status, :notes, "
                ":verifier_gross, :verifier_deductions, :verified_at)"
            ),
            chunk,
        )
    session.commit()
    print(f"✓  ({len(verifications):,} verifications)")


def seed_grievances(
    session: Session,
    workers: list[dict],
    platforms: list[dict],
) -> list[dict]:
    """
    60+ grievances:
    - 10+ workers filing commission_change about Careem in same week (clustering)
    - Other realistic grievances spread across platforms and categories
    """
    print("Seeding grievances...", end=" ", flush=True)

    platform_by_name = {p["name"]: p for p in platforms}
    careem_id = platform_by_name["Careem"]["id"]

    CATEGORIES = [
        "commission_change", "deactivation", "payment_delay",
        "unfair_rating", "safety", "other",
    ]
    COMMISSION_DESCRIPTIONS = [
        "Careem suddenly increased their commission rate from 20% to 30% this week without any prior notice. My take-home pay dropped significantly.",
        "Commission changed overnight from 22% to 30%. This is unacceptable and affecting my livelihood.",
        "Careem raised commission to 30% in week 8. I had no warning and couldn't plan my finances.",
        "My Careem commission rate jumped to 30% this week. This is a clear exploitation of drivers.",
        "Platform changed commission rate without notifying drivers. From 22% to 30% is a huge jump.",
        "Careem increased deductions to 30% suddenly. Many drivers in my area noticed the same.",
        "This week my Careem earnings showed 30% platform deduction. It was 22% last week.",
        "Commission rate spike on Careem this week — went from 23% to 30%. I am filing this grievance.",
        "Unexpected commission increase on Careem. Drivers group WhatsApp confirmed everyone affected.",
        "Careem commission jumped to 30% in week 8 without explanation or notification to drivers.",
        "Platform deductions on Careem have increased drastically this week. Demanding explanation.",
        "Careem app showing 30% commission this week. Last week it was 22%. No official communication.",
    ]

    grievances: list[dict] = []

    # Cluster: 12 Careem commission_change grievances in week 8 (Feb 17-23, 2026)
    cluster_week_start = date(2026, 2, 16)
    cluster_workers = random.sample(workers, 12)
    for i, w in enumerate(cluster_workers):
        created = datetime.combine(
            cluster_week_start + timedelta(days=random.randint(0, 6)),
            datetime.min.time(),
        ) + timedelta(hours=random.randint(8, 20))
        row = {
            "id": pk(),
            "worker_id": w["id"],
            "platform_id": careem_id,
            "category": "commission_change",
            "description": COMMISSION_DESCRIPTIONS[i % len(COMMISSION_DESCRIPTIONS)],
            "status": random.choice(["open", "open", "escalated"]),
            "is_anonymous": random.choice([True, True, False]),
            "resolution_notes": None,
            "created_at": created,
            "updated_at": created,
        }
        grievances.append(row)

    # Other grievances spread across remaining workers and platforms
    other_desc = {
        "deactivation": [
            "My account was deactivated without any reason given. I have been driving for 3 years with 4.8 rating.",
            "Platform deactivated me after a customer complaint I know nothing about. No appeal process.",
            "Account suspended for 14 days with no explanation. My family depends on this income.",
        ],
        "payment_delay": [
            "Payment not received for 5 completed orders. Support is unresponsive.",
            "Earnings from last week still not transferred to my bank account after 10 days.",
            "Foodpanda has delayed my weekly settlement for the third time this month.",
        ],
        "unfair_rating": [
            "Customer gave 1 star because of traffic delay outside my control. Platform won't remove it.",
            "My rating dropped after delivering in rain — the customer wanted refund and rated me 1 star.",
            "Rating system seems rigged. Low ratings after perfect deliveries.",
        ],
        "safety": [
            "No safety feature to report dangerous route assignments at night.",
            "Was assigned a pickup in a high-risk area with no alternative option.",
            "Emergency button not working on the app during a threatening situation.",
        ],
        "other": [
            "App crashes during peak hours causing loss of income.",
            "Navigation in app is outdated and sends drivers to wrong locations.",
            "Customer support takes 5+ days to respond to any query.",
        ],
    }

    remaining_workers = [w for w in workers if w not in cluster_workers]
    for _ in range(55):
        w = random.choice(remaining_workers)
        platform = random.choice(platforms)
        category = random.choice(CATEGORIES)
        desc_pool = other_desc.get(category, other_desc["other"])
        created = datetime.utcnow() - timedelta(days=random.randint(0, 85))
        row = {
            "id": pk(),
            "worker_id": w["id"],
            "platform_id": platform["id"],
            "category": category,
            "description": random.choice(desc_pool),
            "status": random.choices(
                ["open", "escalated", "resolved"], weights=[50, 30, 20]
            )[0],
            "is_anonymous": random.choice([True, True, False]),
            "resolution_notes": None,
            "created_at": created,
            "updated_at": created,
        }
        grievances.append(row)

    for g in grievances:
        session.execute(
            text(
                "INSERT INTO grievances "
                "(id, worker_id, platform_id, category, description, status, "
                "is_anonymous, resolution_notes, created_at, updated_at) "
                "VALUES (:id, :worker_id, :platform_id, :category, :description, "
                ":status, :is_anonymous, :resolution_notes, :created_at, :updated_at)"
            ),
            g,
        )
    session.commit()
    print(f"✓  ({len(grievances)} grievances)")
    return grievances


def seed_grievance_tags(session: Session, grievances: list[dict]) -> None:
    """Auto-generate 2-3 tags per grievance based on category."""
    print("Seeding grievance tags...", end=" ", flush=True)

    TAG_MAP = {
        "commission_change": ["commission_increase", "pay_cut", "platform_policy"],
        "deactivation": ["deactivation", "account_suspended", "no_reason_given"],
        "payment_delay": ["payment_delay", "unpaid_earnings", "settlement_issue"],
        "unfair_rating": ["unfair_rating", "rating_manipulation", "customer_abuse"],
        "safety": ["safety", "dangerous_route", "emergency_feature"],
        "other": ["app_bug", "poor_support", "navigation_issue"],
    }

    tags: list[dict] = []
    seen: set[tuple] = set()

    for g in grievances:
        tag_pool = TAG_MAP.get(g["category"], ["general"])
        num_tags = random.randint(2, 3)
        for tag in random.sample(tag_pool, min(num_tags, len(tag_pool))):
            key = (g["id"], tag)
            if key not in seen:
                seen.add(key)
                tags.append({"id": pk(), "grievance_id": g["id"], "tag": tag})

    for t in tags:
        session.execute(
            text(
                "INSERT INTO grievance_tags (id, grievance_id, tag) "
                "VALUES (:id, :grievance_id, :tag)"
            ),
            t,
        )
    session.commit()
    print(f"✓  ({len(tags)} tags)")


def seed_anomaly_results(
    session: Session,
    workers: list[dict],
    shifts: list[dict],
    platforms: list[dict],
) -> None:
    """
    Pre-compute 40+ anomaly results:
    - Commission spikes (Careem week 8)
    - Income drops (5 workers in month 3)
    - High hours flags
    """
    print("Seeding anomaly results...", end=" ", flush=True)

    platform_by_name = {p["name"]: p for p in platforms}
    careem_id = platform_by_name["Careem"]["id"]

    # Careem week-8 commission spike anomalies
    week8_start = date(2026, 2, 16)
    week8_end = date(2026, 2, 22)
    week8_careem = [
        s for s in shifts
        if s["platform_id"] == careem_id
        and week8_start <= s["shift_date"] <= week8_end
    ]

    anomalies: list[dict] = []

    # Rate spike anomalies from Careem week 8
    sample_spikes = random.sample(week8_careem, min(20, len(week8_careem)))
    for shift in sample_spikes:
        actual_rate = float(shift["platform_deductions"]) / float(shift["gross_earned"]) * 100
        row = {
            "id": pk(),
            "worker_id": shift["worker_id"],
            "shift_log_id": shift["id"],
            "anomaly_type": "rate_spike",
            "severity": "high",
            "metric_name": "commission_rate",
            "expected_low": Decimal("20.00"),
            "expected_high": Decimal("25.00"),
            "actual_value": Decimal(str(round(actual_rate, 2))),
            "deviation_score": Decimal(str(round((actual_rate - 22.5) / 1.5, 2))),
            "explanation": (
                f"Careem commission rate of {actual_rate:.1f}% is significantly above the "
                f"normal range of 20-25%. This spike occurred during week 8 of 2026 and "
                f"affected multiple drivers in your area."
            ),
            "detected_at": datetime.utcnow() - timedelta(days=random.randint(0, 30)),
        }
        anomalies.append(row)

    # MoM income drop anomalies — find shifts from workers with drops
    all_worker_ids = {s["worker_id"] for s in shifts}
    # Simulate 5 workers with income drops
    drop_worker_ids = random.sample(list(all_worker_ids), 5)
    for wid in drop_worker_ids:
        row = {
            "id": pk(),
            "worker_id": wid,
            "shift_log_id": None,
            "anomaly_type": "mom_drop",
            "severity": "high",
            "metric_name": "monthly_net_income",
            "expected_low": Decimal("35000.00"),
            "expected_high": Decimal("55000.00"),
            "actual_value": Decimal(str(round(random.uniform(20000, 30000), 2))),
            "deviation_score": Decimal("-2.50"),
            "explanation": (
                "Your net income in March 2026 dropped by more than 20% compared to "
                "February 2026. This may indicate fewer working days, lower platform "
                "rates, or a change in shift frequency."
            ),
            "detected_at": datetime.utcnow() - timedelta(days=random.randint(0, 15)),
        }
        anomalies.append(row)

    # Hours sanity check anomalies
    long_shifts = [s for s in shifts if float(s["hours_worked"]) >= 9.5]
    sample_long = random.sample(long_shifts, min(10, len(long_shifts)))
    for shift in sample_long:
        hours = float(shift["hours_worked"])
        row = {
            "id": pk(),
            "worker_id": shift["worker_id"],
            "shift_log_id": shift["id"],
            "anomaly_type": "hours_mismatch",
            "severity": "low" if hours < 12 else "medium",
            "metric_name": "hours_worked",
            "expected_low": Decimal("1.00"),
            "expected_high": Decimal("12.00"),
            "actual_value": Decimal(str(hours)),
            "deviation_score": Decimal(str(round((hours - 8) / 2, 2))),
            "explanation": (
                f"A shift of {hours:.1f} hours is unusually long. "
                f"Please verify this entry is correct."
            ),
            "detected_at": shift["created_at"] + timedelta(days=1),
        }
        anomalies.append(row)

    # IQR-based income drop anomalies
    for _ in range(8):
        w = random.choice(workers)
        row = {
            "id": pk(),
            "worker_id": w["id"],
            "shift_log_id": None,
            "anomaly_type": "income_drop",
            "severity": random.choice(["low", "medium"]),
            "metric_name": "daily_net_income",
            "expected_low": Decimal(str(round(random.uniform(1500, 2500), 2))),
            "expected_high": Decimal(str(round(random.uniform(3500, 5000), 2))),
            "actual_value": Decimal(str(round(random.uniform(500, 1400), 2))),
            "deviation_score": Decimal(str(round(random.uniform(-2.5, -1.6), 2))),
            "explanation": (
                "Daily net income fell below the lower fence of your historical IQR range. "
                "This may reflect fewer trips, route changes, or increased platform deductions."
            ),
            "detected_at": datetime.utcnow() - timedelta(days=random.randint(5, 60)),
        }
        anomalies.append(row)

    for i in range(0, len(anomalies), 200):
        chunk = anomalies[i : i + 200]
        session.execute(
            text(
                "INSERT INTO anomaly_results "
                "(id, worker_id, shift_log_id, anomaly_type, severity, metric_name, "
                "expected_low, expected_high, actual_value, deviation_score, explanation, detected_at) "
                "VALUES (:id, :worker_id, :shift_log_id, :anomaly_type, :severity, "
                ":metric_name, :expected_low, :expected_high, :actual_value, "
                ":deviation_score, :explanation, :detected_at)"
            ),
            chunk,
        )
    session.commit()
    print(f"✓  ({len(anomalies)} anomaly results)")


def refresh_materialized_view(session: Session) -> None:
    print("Refreshing materialized view...", end=" ", flush=True)
    session.execute(text("REFRESH MATERIALIZED VIEW monthly_worker_totals"))
    session.commit()
    print("✓")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    print("\n=== FairGig Seed Script ===\n")
    with SessionLocal() as session:
        truncate_all(session)
        zones = seed_city_zones(session)
        platforms = seed_platforms(session)
        workers, verifiers, advocates = seed_users(session, zones)
        seed_file_uploads(session, workers)
        shifts = seed_shift_logs(session, workers, platforms, zones)
        screenshots = seed_screenshots(session, shifts)
        seed_verifications(session, shifts, verifiers, screenshots)
        grievances = seed_grievances(session, workers, platforms)
        seed_grievance_tags(session, grievances)
        seed_anomaly_results(session, workers, shifts, platforms)
        refresh_materialized_view(session)

    print("\n=== Seed complete! ===")
    print(f"  City zones:       {len(zones)}")
    print(f"  Platforms:        {len(platforms)}")
    print(f"  Workers:          {len(workers)}")
    print(f"  Verifiers:        10")
    print(f"  Advocates:        5")
    print(f"  Shift logs:       ~{len(shifts):,}")
    print(f"  Screenshots:      ~5,500")
    print(f"  Verifications:    ~5,000 (~4,000 verified shifts)")
    print(f"  Grievances:       67")
    print()
    print("Run: SELECT * FROM zone_earnings_summary LIMIT 5;")
    print("     to verify k-anonymized aggregates are populated.\n")


if __name__ == "__main__":
    main()
