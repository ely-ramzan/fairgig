"""Quick query: screenshots uploaded in the last hour."""
from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

_raw = os.getenv("DATABASE_URL", "postgresql://postgres:password@localhost:5432/fairgig")
DB_URL = _raw.replace("postgresql+asyncpg://", "postgresql://")
if "neon.tech" in DB_URL and "sslmode" not in DB_URL:
    DB_URL += "?sslmode=require"

engine = create_engine(DB_URL, echo=False)

with engine.connect() as conn:
    rows = conn.execute(text("""
        SELECT id, shift_log_id, original_filename, cloudinary_url, uploaded_at
        FROM screenshots
        WHERE uploaded_at >= NOW() - INTERVAL '1 hour'
        ORDER BY uploaded_at DESC
    """)).fetchall()

if not rows:
    print("No screenshots uploaded in the last hour.")
else:
    print(f"Found {len(rows)} screenshot(s) uploaded in the last hour:\n")
    for r in rows:
        print(f"  id            : {r[0]}")
        print(f"  shift_log_id  : {r[1]}")
        print(f"  filename      : {r[2]}")
        print(f"  cloudinary_url: {r[3]}")
        print(f"  uploaded_at   : {r[4]}")
        print()
