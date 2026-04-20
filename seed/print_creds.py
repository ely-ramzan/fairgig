from dotenv import load_dotenv
from pathlib import Path
from sqlalchemy import create_engine, text
import os

load_dotenv(Path(__file__).parents[1] / ".env")
url = os.environ.get("DATABASE_URL", "").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(url)
with engine.connect() as conn:
    rows = conn.execute(text("SELECT email, role FROM users WHERE role IN ('verifier','advocate') ORDER BY role, email"))
    print(f"\n{'Role':<12} {'Email'}")
    print("-" * 50)
    for r in rows:
        print(f"{r.role:<12} {r.email}")
    print("\nPassword for all: Secure@123")
