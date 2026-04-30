"""
Migration: Add vehicles table and vehicle_id to sensor_logs.
Run once: python migrate_vehicles.py
"""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), "backend", "cryotrace.db")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Create vehicles table
cursor.execute("""
CREATE TABLE IF NOT EXISTS vehicles (
    id                TEXT PRIMARY KEY,
    vehicle_number    TEXT UNIQUE NOT NULL,
    vehicle_type      TEXT DEFAULT 'truck',
    driver_name       TEXT,
    carrier_name      TEXT,
    route_name        TEXT,
    device_id         TEXT,
    current_lat       REAL,
    current_lng       REAL,
    current_temp      REAL,
    current_humidity  REAL,
    current_battery   REAL,
    last_seen         DATETIME,
    status            TEXT DEFAULT 'idle',
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
)
""")
print("[OK] vehicles table created (or already exists)")

# Add vehicle_id column to sensor_logs if it doesn't exist
try:
    cursor.execute("ALTER TABLE sensor_logs ADD COLUMN vehicle_id TEXT REFERENCES vehicles(id)")
    print("[OK] vehicle_id column added to sensor_logs")
except sqlite3.OperationalError as e:
    if "duplicate column" in str(e).lower():
        print("[OK] vehicle_id already exists in sensor_logs")
    else:
        raise

conn.commit()
conn.close()
print("\nMigration complete.")
