import sqlite3
import os
from contextlib import contextmanager

DB_PATH = os.path.join(os.path.dirname(__file__), "tradeledger.db")

@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            initial_capital REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE
        );
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL REFERENCES categories(id),
            name TEXT NOT NULL,
            remark TEXT
        );
        CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            account_id INTEGER NOT NULL REFERENCES accounts(id),
            product_id INTEGER NOT NULL REFERENCES products(id),
            direction TEXT NOT NULL CHECK(direction IN ('buy','sell')),
            price REAL NOT NULL,
            quantity REAL NOT NULL,
            amount REAL NOT NULL,
            fee REAL NOT NULL DEFAULT 0,
            platform TEXT,
            remark TEXT,
            trade_date TEXT NOT NULL,
            profit REAL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        """)
        conn.commit()
        cur = conn.execute("SELECT id FROM categories WHERE name='其它'")
        if not cur.fetchone():
            conn.execute("INSERT INTO categories (name) VALUES ('其它')")
            conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized at", DB_PATH)
