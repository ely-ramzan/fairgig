#!/usr/bin/env python3
"""Script to add UUID defaults to existing tables"""

import os
from pathlib import Path

# Load environment
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / ".env")

from sqlalchemy import create_engine, text

def main():
    # Use sync URL for this script
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("DATABASE_URL not found")
        return

    # Convert async URL to sync URL
    sync_url = database_url.replace("+asyncpg", "")

    engine = create_engine(sync_url)

    with engine.connect() as conn:
        # Add UUID defaults
        conn.execute(text("ALTER TABLE grievances ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
        conn.execute(text("ALTER TABLE grievance_tags ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
        conn.execute(text("ALTER TABLE anomaly_results ALTER COLUMN id SET DEFAULT gen_random_uuid()"))
        conn.commit()
        print("UUID defaults added successfully")

if __name__ == "__main__":
    main()