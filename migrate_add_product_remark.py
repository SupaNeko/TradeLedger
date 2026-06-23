import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "tradeledger.db")

conn = sqlite3.connect(DB_PATH)
cur = conn.execute("PRAGMA table_info(products)")
columns = [row[1] for row in cur.fetchall()]

if 'remark' not in columns:
    print("Adding remark column to products table...")
    conn.execute("ALTER TABLE products ADD COLUMN remark TEXT")
    conn.commit()
    print("Done.")
else:
    print("remark column already exists.")

conn.close()
