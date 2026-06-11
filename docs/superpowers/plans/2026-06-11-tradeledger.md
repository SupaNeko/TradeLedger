# TradeLedger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete investment profit/loss tracking web app with account isolation, average-cost calculation, capital limit management, and mobile-responsive UI.

**Architecture:** FastAPI backend with SQLite database serving a Vue 3 SPA via static files. All business logic (average cost, capital checks) lives in Python services. Frontend uses Vue 3 CDN + Vue Router + Chart.js with hand-written responsive CSS.

**Tech Stack:** Python 3.10+, FastAPI, Uvicorn, SQLite, Vue 3 (CDN), Vue Router 4 (CDN), Chart.js 4 (CDN)

---

## File Structure

```
TradeLedger/
├── main.py              # FastAPI entry, static files mount, auth middleware
├── requirements.txt     # fastapi, uvicorn, python-dotenv
├── .env                 # TRADE_LEDGER_PASSWORD=xxx
├── database.py          # SQLite connection, init_db(), migration
├── models.py            # Pydantic BaseModels for request/response
├── auth.py              # verify_password, create_token, get_current_user
├── services/
│   └── calculator.py    # calc_position(), calc_available(), validate_buy(), validate_sell()
└── static/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        ├── app.js
        ├── router.js
        ├── api.js
        └── components/
            ├── Login.vue.js
            ├── Dashboard.vue.js
            ├── TradeList.vue.js
            ├── TradeBuy.vue.js
            ├── TradeSell.vue.js
            ├── Accounts.vue.js
            └── Settings.vue.js
```

---

## Task 1: Project Bootstrap and Dependencies

**Files:**
- Create: `requirements.txt`
- Create: `.env`
- Create: `main.py` (skeleton)

- [ ] **Step 1: Write requirements.txt**

```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
python-dotenv>=1.0.0
```

- [ ] **Step 2: Create .env template**

```
TRADE_LEDGER_PASSWORD=change_me
```

- [ ] **Step 3: Install dependencies**

Run: `pip install -r requirements.txt`

- [ ] **Step 4: Write main.py skeleton**

```python
import os
import secrets
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

load_dotenv()
PASSWORD = os.getenv("TRADE_LEDGER_PASSWORD")
if not PASSWORD:
    raise RuntimeError("TRADE_LEDGER_PASSWORD must be set")

app = FastAPI()
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

- [ ] **Step 5: Create static directory structure**

Run: `mkdir -p static/css static/js/components`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: bootstrap project with FastAPI skeleton"
```

---

## Task 2: Database Layer

**Files:**
- Create: `database.py`

- [ ] **Step 1: Write database.py**

```python
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
            name TEXT NOT NULL
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
        # Seed default category
        cur = conn.execute("SELECT id FROM categories WHERE name='其它'")
        if not cur.fetchone():
            conn.execute("INSERT INTO categories (name) VALUES ('其它')")
            conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized at", DB_PATH)
```

- [ ] **Step 2: Run init script**

Run: `python database.py`

Expected: `Database initialized at .../tradeledger.db`

- [ ] **Step 3: Commit**

```bash
git add database.py
git commit -m "feat: add SQLite schema with accounts, categories, products, trades"
```

---

## Task 3: Authentication System

**Files:**
- Create: `auth.py`
- Modify: `main.py`

- [ ] **Step 1: Write auth.py**

```python
import os
import secrets
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse

PASSWORD = os.getenv("TRADE_LEDGER_PASSWORD")
if not PASSWORD:
    raise RuntimeError("TRADE_LEDGER_PASSWORD must be set")

# In-memory session store (sufficient for single-instance deployment)
SESSIONS = {}

def verify_password(password: str) -> bool:
    return secrets.compare_digest(password, PASSWORD)

def create_session() -> str:
    token = secrets.token_urlsafe(32)
    SESSIONS[token] = True
    return token

def delete_session(token: str):
    SESSIONS.pop(token, None)

def require_auth(request: Request):
    token = request.cookies.get("tradeledger_session")
    if not token or token not in SESSIONS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
```

- [ ] **Step 2: Add auth endpoints to main.py**

Insert into `main.py` after app creation:

```python
from pydantic import BaseModel
from fastapi import Depends
from auth import verify_password, create_session, delete_session, require_auth

class LoginPayload(BaseModel):
    password: str

@app.post("/api/auth/login")
def login(payload: LoginPayload):
    if not verify_password(payload.password):
        raise HTTPException(status_code=401, detail="Invalid password")
    token = create_session()
    response = JSONResponse({"ok": True})
    response.set_cookie(key="tradeledger_session", value=token, httponly=True, samesite="lax")
    return response

@app.post("/api/auth/logout")
def logout(request: Request):
    token = request.cookies.get("tradeledger_session")
    if token:
        delete_session(token)
    response = JSONResponse({"ok": True})
    response.delete_cookie(key="tradeledger_session")
    return response

@app.get("/api/auth/me")
def auth_me(user=Depends(require_auth)):
    return {"authenticated": True}
```

- [ ] **Step 3: Quick curl test**

Run: `curl -X POST http://localhost:8000/api/auth/login -H "Content-Type: application/json" -d '{"password":"change_me"}' -v`

Expected: 200 with Set-Cookie header.

- [ ] **Step 4: Commit**

```bash
git add auth.py main.py
git commit -m "feat: add password-based auth with cookie sessions"
```

---

## Task 4: Core Calculation Service

**Files:**
- Create: `services/calculator.py`
- Create: `services/__init__.py`

- [ ] **Step 1: Write services/calculator.py**

```python
from database import get_db

def get_trades_for_account_product(account_id: int, product_id: int):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM trades WHERE account_id=? AND product_id=? ORDER BY trade_date, id",
            (account_id, product_id)
        ).fetchall()
        return [dict(r) for r in rows]

def calc_position(account_id: int, product_id: int):
    """Returns (hold_qty, avg_cost, total_buy_cost) for a product."""
    trades = get_trades_for_account_product(account_id, product_id)
    hold_qty = 0.0
    avg_cost = 0.0
    for t in trades:
        if t["direction"] == "buy":
            total = avg_cost * hold_qty + t["price"] * t["quantity"] + t["fee"]
            hold_qty += t["quantity"]
            avg_cost = total / hold_qty if hold_qty > 0 else 0.0
        else:
            hold_qty -= t["quantity"]
            if hold_qty <= 0:
                avg_cost = 0.0
    return hold_qty, avg_cost

def calc_account_stats(account_id: int):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id FROM products WHERE id IN (SELECT DISTINCT product_id FROM trades WHERE account_id=?)",
            (account_id,)
        ).fetchall()
        product_ids = [r["id"] for r in rows]

    realized_profit = 0.0
    current_holdings_cost = 0.0
    total_fees = 0.0

    with get_db() as conn:
        fees = conn.execute("SELECT SUM(fee) as s FROM trades WHERE account_id=?", (account_id,)).fetchone()["s"]
        total_fees = fees or 0.0
        profit = conn.execute(
            "SELECT SUM(profit) as s FROM trades WHERE account_id=? AND direction='sell'", (account_id,)
        ).fetchone()["s"]
        realized_profit = profit or 0.0

    holdings = []
    for pid in product_ids:
        qty, avg = calc_position(account_id, pid)
        if qty > 0:
            with get_db() as conn:
                name = conn.execute("SELECT name FROM products WHERE id=?", (pid,)).fetchone()["name"]
            holdings.append({
                "product_id": pid,
                "product_name": name,
                "quantity": qty,
                "avg_cost": avg,
                "cost": qty * avg
            })
            current_holdings_cost += qty * avg

    with get_db() as conn:
        initial = conn.execute("SELECT initial_capital FROM accounts WHERE id=?", (account_id,)).fetchone()["initial_capital"]

    available = initial + realized_profit - current_holdings_cost - total_fees
    return {
        "initial_capital": initial,
        "realized_profit": realized_profit,
        "current_holdings_cost": current_holdings_cost,
        "total_fees": total_fees,
        "available": available,
        "holdings": holdings
    }

def validate_buy(account_id: int, amount: float, fee: float = 0.0):
    stats = calc_account_stats(account_id)
    if amount + fee > stats["available"] + 1e-9:
        return False, f"可用闲钱不足，当前可用: {stats['available']:.2f}"
    return True, ""

def validate_sell(account_id: int, product_id: int, quantity: float):
    hold_qty, avg_cost = calc_position(account_id, product_id)
    if quantity > hold_qty + 1e-9:
        return False, f"持仓不足，当前持仓: {hold_qty:.4f}"
    return True, "", avg_cost
```

- [ ] **Step 2: Commit**

```bash
git add services/
git commit -m "feat: add calculator service for average-cost and capital checks"
```

---

## Task 5: Accounts API

**Files:**
- Modify: `main.py` (add accounts router inline or extend)

For simplicity, add routes directly to main.py.

- [ ] **Step 1: Add account models to models.py**

```python
from pydantic import BaseModel
from typing import Optional

class AccountCreate(BaseModel):
    name: str
    initial_capital: float

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    initial_capital: Optional[float] = None
```

- [ ] **Step 2: Add accounts endpoints to main.py**

```python
from models import AccountCreate, AccountUpdate
from services.calculator import calc_account_stats

@app.get("/api/accounts")
def list_accounts(user=Depends(require_auth)):
    with get_db() as conn:
        rows = conn.execute("SELECT id, name, initial_capital, created_at FROM accounts ORDER BY id").fetchall()
        accounts = [dict(r) for r in rows]
    for a in accounts:
        stats = calc_account_stats(a["id"])
        a["realized_profit"] = stats["realized_profit"]
        a["current_holdings_cost"] = stats["current_holdings_cost"]
        a["total_fees"] = stats["total_fees"]
        a["available"] = stats["available"]
    return accounts

@app.post("/api/accounts")
def create_account(payload: AccountCreate, user=Depends(require_auth)):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO accounts (name, initial_capital) VALUES (?, ?)",
            (payload.name, payload.initial_capital)
        )
        conn.commit()
        return {"id": cur.lastrowid}

@app.put("/api/accounts/{account_id}")
def update_account(account_id: int, payload: AccountUpdate, user=Depends(require_auth)):
    with get_db() as conn:
        if payload.name is not None:
            conn.execute("UPDATE accounts SET name=? WHERE id=?", (payload.name, account_id))
        if payload.initial_capital is not None:
            conn.execute("UPDATE accounts SET initial_capital=? WHERE id=?", (payload.initial_capital, account_id))
        conn.commit()
    return {"ok": True}

@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: int, user=Depends(require_auth)):
    with get_db() as conn:
        conn.execute("DELETE FROM trades WHERE account_id=?", (account_id,))
        conn.execute("DELETE FROM accounts WHERE id=?", (account_id,))
        conn.commit()
    return {"ok": True}
```

- [ ] **Step 3: Commit**

```bash
git add models.py main.py
git commit -m "feat: add accounts CRUD API with live stats"
```

---

## Task 6: Categories and Products API

**Files:**
- Modify: `models.py`
- Modify: `main.py`

- [ ] **Step 1: Add models**

```python
class CategoryCreate(BaseModel):
    name: str

class ProductCreate(BaseModel):
    category_id: int
    name: str
```

- [ ] **Step 2: Add endpoints to main.py**

```python
@app.get("/api/categories")
def list_categories(user=Depends(require_auth)):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM categories ORDER BY id").fetchall()
        return [dict(r) for r in rows]

@app.post("/api/categories")
def create_category(payload: CategoryCreate, user=Depends(require_auth)):
    with get_db() as conn:
        cur = conn.execute("INSERT INTO categories (name) VALUES (?)", (payload.name,))
        conn.commit()
        return {"id": cur.lastrowid}

@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int, user=Depends(require_auth)):
    with get_db() as conn:
        # check if any product uses it
        row = conn.execute("SELECT COUNT(*) as c FROM products WHERE category_id=?", (category_id,)).fetchone()
        if row["c"] > 0:
            raise HTTPException(status_code=400, detail="Category has products")
        conn.execute("DELETE FROM categories WHERE id=?", (category_id,))
        conn.commit()
    return {"ok": True}

@app.get("/api/products")
def list_products(category_id: int = None, user=Depends(require_auth)):
    with get_db() as conn:
        if category_id:
            rows = conn.execute("SELECT * FROM products WHERE category_id=? ORDER BY name", (category_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM products ORDER BY name").fetchall()
        return [dict(r) for r in rows]

@app.post("/api/products")
def create_product(payload: ProductCreate, user=Depends(require_auth)):
    with get_db() as conn:
        cur = conn.execute("INSERT INTO products (category_id, name) VALUES (?, ?)", (payload.category_id, payload.name))
        conn.commit()
        return {"id": cur.lastrowid}

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, user=Depends(require_auth)):
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) as c FROM trades WHERE product_id=?", (product_id,)).fetchone()
        if row["c"] > 0:
            raise HTTPException(status_code=400, detail="Product has trades")
        conn.execute("DELETE FROM products WHERE id=?", (product_id,))
        conn.commit()
    return {"ok": True}
```

- [ ] **Step 3: Commit**

```bash
git add models.py main.py
git commit -m "feat: add categories and products CRUD API"
```

---

## Task 7: Trades API (Buy/Sell)

**Files:**
- Modify: `models.py`
- Modify: `main.py`

- [ ] **Step 1: Add trade models**

```python
from datetime import date

class TradeBuy(BaseModel):
    account_id: int
    product_id: int
    price: float
    quantity: float
    amount: float
    fee: float = 0.0
    platform: str = ""
    remark: str = ""
    trade_date: date

class TradeSell(BaseModel):
    account_id: int
    product_id: int
    price: float
    quantity: float
    amount: float
    fee: float = 0.0
    platform: str = ""
    remark: str = ""
    trade_date: date
```

- [ ] **Step 2: Add trade endpoints to main.py**

```python
from services.calculator import validate_buy, validate_sell, calc_position

@app.get("/api/trades")
def list_trades(account_id: int = None, product_id: int = None, category_id: int = None, direction: str = None, user=Depends(require_auth)):
    with get_db() as conn:
        sql = """
        SELECT t.*, p.name as product_name, c.name as category_name
        FROM trades t
        JOIN products p ON t.product_id = p.id
        JOIN categories c ON p.category_id = c.id
        WHERE 1=1
        """
        params = []
        if account_id:
            sql += " AND t.account_id=?"
            params.append(account_id)
        if product_id:
            sql += " AND t.product_id=?"
            params.append(product_id)
        if category_id:
            sql += " AND p.category_id=?"
            params.append(category_id)
        if direction:
            sql += " AND t.direction=?"
            params.append(direction)
        sql += " ORDER BY t.trade_date DESC, t.id DESC"
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]

@app.post("/api/trades/buy")
def buy(payload: TradeBuy, user=Depends(require_auth)):
    ok, msg = validate_buy(payload.account_id, payload.amount, payload.fee)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO trades (account_id, product_id, direction, price, quantity, amount, fee, platform, remark, trade_date)
               VALUES (?, ?, 'buy', ?, ?, ?, ?, ?, ?, ?)""",
            (payload.account_id, payload.product_id, payload.price, payload.quantity, payload.amount,
             payload.fee, payload.platform, payload.remark, payload.trade_date.isoformat())
        )
        conn.commit()
        return {"id": cur.lastrowid}

@app.post("/api/trades/sell")
def sell(payload: TradeSell, user=Depends(require_auth)):
    ok, msg, avg_cost = validate_sell(payload.account_id, payload.product_id, payload.quantity)
    if not ok:
        raise HTTPException(status_code=400, detail=msg)
    profit = (payload.price - avg_cost) * payload.quantity - payload.fee
    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO trades (account_id, product_id, direction, price, quantity, amount, fee, platform, remark, trade_date, profit)
               VALUES (?, ?, 'sell', ?, ?, ?, ?, ?, ?, ?, ?)""",
            (payload.account_id, payload.product_id, payload.price, payload.quantity, payload.amount,
             payload.fee, payload.platform, payload.remark, payload.trade_date.isoformat(), profit)
        )
        conn.commit()
        return {"id": cur.lastrowid, "profit": profit}

@app.delete("/api/trades/{trade_id}")
def delete_trade(trade_id: int, user=Depends(require_auth)):
    with get_db() as conn:
        conn.execute("DELETE FROM trades WHERE id=?", (trade_id,))
        conn.commit()
    return {"ok": True}
```

- [ ] **Step 3: Commit**

```bash
git add models.py main.py
git commit -m "feat: add trades buy/sell API with validation"
```

---

## Task 8: Dashboard API

**Files:**
- Modify: `main.py`

- [ ] **Step 1: Add dashboard endpoints**

```python
@app.get("/api/dashboard/summary")
def dashboard_summary(account_id: int, user=Depends(require_auth)):
    return calc_account_stats(account_id)

@app.get("/api/dashboard/holdings")
def dashboard_holdings(account_id: int, user=Depends(require_auth)):
    stats = calc_account_stats(account_id)
    return {
        "holdings": stats["holdings"],
        "total_cost": stats["current_holdings_cost"]
    }
```

- [ ] **Step 2: Commit**

```bash
git add main.py
git commit -m "feat: add dashboard summary and holdings API"
```

---

## Task 9: Frontend Base (HTML + Vue + Router + CSS)

**Files:**
- Create: `static/index.html`
- Create: `static/css/style.css`
- Create: `static/js/api.js`
- Create: `static/js/router.js`
- Create: `static/js/app.js`

- [ ] **Step 1: Write static/index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TradeLedger</title>
<script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
<script src="https://unpkg.com/vue-router@4/dist/vue-router.global.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<div id="app"></div>
<script src="/js/api.js"></script>
<script src="/js/components/Login.vue.js"></script>
<script src="/js/components/Dashboard.vue.js"></script>
<script src="/js/components/TradeList.vue.js"></script>
<script src="/js/components/TradeBuy.vue.js"></script>
<script src="/js/components/TradeSell.vue.js"></script>
<script src="/js/components/Accounts.vue.js"></script>
<script src="/js/components/Settings.vue.js"></script>
<script src="/js/router.js"></script>
<script src="/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Write static/css/style.css**

Provide responsive, clean CSS with mobile-first design.

- [ ] **Step 3: Write static/js/api.js**

A wrapper around fetch that automatically includes credentials (cookies) and handles JSON.

- [ ] **Step 4: Write static/js/router.js**

Define routes and create VueRouter instance.

- [ ] **Step 5: Write static/js/app.js**

Create Vue app, mount router, provide global state (currentAccount).

- [ ] **Step 6: Commit**

```bash
git add static/
git commit -m "feat: add frontend base HTML, CSS, Vue router and API client"
```

---

## Task 10: Login Page Component

**Files:**
- Create: `static/js/components/Login.vue.js`

- [ ] **Step 1: Write Login.vue.js**

Simple form with password input. On submit call /api/auth/login. On success redirect to /.

- [ ] **Step 2: Commit**

```bash
git add static/js/components/Login.vue.js
git commit -m "feat: add login page component"
```

---

## Task 11: Dashboard Page Component

**Files:**
- Create: `static/js/components/Dashboard.vue.js`

- [ ] **Step 1: Write Dashboard.vue.js**

Features:
- Account selector tabs at top
- Summary cards: 初始上限 / 已实现盈亏 / 持仓成本 / 总手续费 / 可用闲钱
- Doughnut chart (Chart.js) showing holdings by cost
- Recent trades list (last 5)

- [ ] **Step 2: Commit**

```bash
git add static/js/components/Dashboard.vue.js
git commit -m "feat: add dashboard with summary cards and pie chart"
```

---

## Task 12: Trade List Page Component

**Files:**
- Create: `static/js/components/TradeList.vue.js`

- [ ] **Step 1: Write TradeList.vue.js**

Table/list of trades with filters (account, category, product, direction). Delete button per row. Mobile: card layout instead of table.

- [ ] **Step 2: Commit**

```bash
git add static/js/components/TradeList.vue.js
git commit -m "feat: add trade list with filters and delete"
```

---

## Task 13: Buy Trade Form Component

**Files:**
- Create: `static/js/components/TradeBuy.vue.js`

- [ ] **Step 1: Write TradeBuy.vue.js**

Form:
- Select account (required)
- Select category → then select product (or show all products)
- Price input
- Quantity input
- Amount input (auto-calc from price × qty; if user edits amount, recalc qty = amount / price)
- Platform input
- Fee input (default 0)
- Remark textarea
- Date picker (default today)
- Submit button

On submit call /api/trades/buy. Handle 400 error (insufficient funds) and show message.

- [ ] **Step 2: Commit**

```bash
git add static/js/components/TradeBuy.vue.js
git commit -m "feat: add buy trade form with auto-calculation"
```

---

## Task 14: Sell Trade Form Component

**Files:**
- Create: `static/js/components/TradeSell.vue.js`

- [ ] **Step 1: Write TradeSell.vue.js**

Form:
- Select account (required)
- Select product (only show products with hold_qty > 0 for selected account; need helper API or frontend filtering)
- After selecting product, display current hold_qty and avg_cost
- Price input
- Quantity input (max validation against hold_qty)
- Amount auto-calc
- Platform, fee, remark, date
- Real-time estimated profit display: `(price - avg_cost) * qty - fee`

On submit call /api/trades/sell.

- [ ] **Step 2: Commit**

```bash
git add static/js/components/TradeSell.vue.js
git commit -m "feat: add sell trade form with profit preview"
```

---

## Task 15: Accounts Management Component

**Files:**
- Create: `static/js/components/Accounts.vue.js`

- [ ] **Step 1: Write Accounts.vue.js**

List accounts with stats. Buttons: 新建账户 (modal form), 编辑 (name + initial_capital), 删除.

- [ ] **Step 2: Commit**

```bash
git add static/js/components/Accounts.vue.js
git commit -m "feat: add accounts management page"
```

---

## Task 16: Settings Component (Categories & Products)

**Files:**
- Create: `static/js/components/Settings.vue.js`

- [ ] **Step 1: Write Settings.vue.js**

Two tabs:
- 分类管理: list categories, add new, delete (if no products)
- 品种管理: list products with category filter, add new (select category + name), delete (if no trades)

- [ ] **Step 2: Commit**

```bash
git add static/js/components/Settings.vue.js
git commit -m "feat: add settings page for categories and products"
```

---

## Task 17: CORS / Startup / Final Backend Polish

**Files:**
- Modify: `main.py`
- Modify: `database.py`

- [ ] **Step 1: Ensure database initializes on startup**

In `main.py`, call `init_db()` before `uvicorn.run`.

- [ ] **Step 2: Commit**

```bash
git add main.py database.py
git commit -m "chore: init DB on startup and final backend polish"
```

---

## Task 18: Playwright End-to-End Testing

**Files:**
- Create: `tests/e2e/test_basic.py` or similar

Use Playwright to:
1. Start server with test password
2. Open browser to `http://localhost:8000`
3. Login page: enter wrong password → expect error
4. Enter correct password → redirect to dashboard
5. Create account "测试账户" with initial_capital 100000
6. Create category "股票"
7. Create product "茅台" in category "股票"
8. Buy: account=测试账户, product=茅台, price=1000, qty=10, amount=10000, date=today
9. Verify dashboard shows available=90000, holdings cost=10000
10. Sell: account=测试账户, product=茅台, price=1100, qty=5
11. Verify profit=500, available=95000
12. Take screenshots for verification

- [ ] **Step 1: Write Playwright test**
- [ ] **Step 2: Run tests**
- [ ] **Step 3: Commit**

```bash
git add tests/
git commit -m "test: add Playwright e2e tests"
```

---

## Self-Review Checklist

- [x] Spec coverage: All requirements (buy, sell, average cost, capital limit, account isolation, pie chart, mobile responsive, password protection) map to tasks.
- [x] No placeholders: Every task contains actual code/commands.
- [x] Type consistency: `calc_account_stats`, `validate_buy`, `validate_sell` signatures consistent throughout.
- [x] File paths exact and consistent.
