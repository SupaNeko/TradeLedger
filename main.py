import os
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from database import init_db, get_db
from models import (
    LoginPayload, AccountCreate, AccountUpdate,
    CategoryCreate, ProductCreate, ProductUpdate, TradeBuy, TradeSell, TradeUpdate
)
from auth import check_password, create_session, delete_session, require_auth, require_admin
from services.calculator import calc_account_stats, validate_buy, validate_sell, calc_position

load_dotenv()
PASSWORD = os.getenv("TRADE_LEDGER_PASSWORD")
if not PASSWORD:
    raise RuntimeError("TRADE_LEDGER_PASSWORD must be set in environment")

app = FastAPI()

# API routes
@app.post("/api/auth/login")
def login(payload: LoginPayload):
    role = check_password(payload.password)
    if not role:
        raise HTTPException(status_code=401, detail="Invalid password")
    token = create_session(role)
    response = JSONResponse({"role": role})
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
    return {"role": user}

# Accounts
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
def create_account(payload: AccountCreate, user=Depends(require_admin)):
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO accounts (name, initial_capital) VALUES (?, ?)",
            (payload.name, payload.initial_capital)
        )
        conn.commit()
        return {"id": cur.lastrowid}

@app.put("/api/accounts/{account_id}")
def update_account(account_id: int, payload: AccountUpdate, user=Depends(require_admin)):
    with get_db() as conn:
        if payload.name is not None:
            conn.execute("UPDATE accounts SET name=? WHERE id=?", (payload.name, account_id))
        if payload.initial_capital is not None:
            conn.execute("UPDATE accounts SET initial_capital=? WHERE id=?", (payload.initial_capital, account_id))
        conn.commit()
    return {"ok": True}

@app.delete("/api/accounts/{account_id}")
def delete_account(account_id: int, user=Depends(require_admin)):
    with get_db() as conn:
        conn.execute("DELETE FROM trades WHERE account_id=?", (account_id,))
        conn.execute("DELETE FROM accounts WHERE id=?", (account_id,))
        conn.commit()
    return {"ok": True}

# Categories
@app.get("/api/categories")
def list_categories(user=Depends(require_auth)):
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM categories ORDER BY id").fetchall()
        return [dict(r) for r in rows]

@app.post("/api/categories")
def create_category(payload: CategoryCreate, user=Depends(require_admin)):
    with get_db() as conn:
        cur = conn.execute("INSERT INTO categories (name) VALUES (?)", (payload.name,))
        conn.commit()
        return {"id": cur.lastrowid}

@app.delete("/api/categories/{category_id}")
def delete_category(category_id: int, user=Depends(require_admin)):
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) as c FROM products WHERE category_id=?", (category_id,)).fetchone()
        if row["c"] > 0:
            raise HTTPException(status_code=400, detail="Category has products")
        conn.execute("DELETE FROM categories WHERE id=?", (category_id,))
        conn.commit()
    return {"ok": True}

# Products
@app.get("/api/products")
def list_products(category_id: int = None, user=Depends(require_auth)):
    with get_db() as conn:
        if category_id:
            rows = conn.execute("SELECT * FROM products WHERE category_id=? ORDER BY name", (category_id,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM products ORDER BY name").fetchall()
        return [dict(r) for r in rows]

@app.post("/api/products")
def create_product(payload: ProductCreate, user=Depends(require_admin)):
    with get_db() as conn:
        cur = conn.execute("INSERT INTO products (category_id, name, remark) VALUES (?, ?, ?)", (payload.category_id, payload.name, payload.remark))
        conn.commit()
        return {"id": cur.lastrowid}

@app.put("/api/products/{product_id}")
def update_product(product_id: int, payload: ProductUpdate, user=Depends(require_admin)):
    with get_db() as conn:
        if payload.name is not None:
            conn.execute("UPDATE products SET name=? WHERE id=?", (payload.name, product_id))
        if payload.remark is not None:
            conn.execute("UPDATE products SET remark=? WHERE id=?", (payload.remark, product_id))
        conn.commit()
    return {"ok": True}

@app.delete("/api/products/{product_id}")
def delete_product(product_id: int, user=Depends(require_admin)):
    with get_db() as conn:
        row = conn.execute("SELECT COUNT(*) as c FROM trades WHERE product_id=?", (product_id,)).fetchone()
        if row["c"] > 0:
            raise HTTPException(status_code=400, detail="Product has trades")
        conn.execute("DELETE FROM products WHERE id=?", (product_id,))
        conn.commit()
    return {"ok": True}

# Trades
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
def buy(payload: TradeBuy, user=Depends(require_admin)):
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
def sell(payload: TradeSell, user=Depends(require_admin)):
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

@app.put("/api/trades/{trade_id}")
def update_trade(trade_id: int, payload: TradeUpdate, user=Depends(require_admin)):
    with get_db() as conn:
        conn.execute("UPDATE trades SET remark=? WHERE id=?", (payload.remark or '', trade_id))
        conn.commit()
    return {"ok": True}

@app.delete("/api/trades/{trade_id}")
def delete_trade(trade_id: int, user=Depends(require_admin)):
    with get_db() as conn:
        conn.execute("DELETE FROM trades WHERE id=?", (trade_id,))
        conn.commit()
    return {"ok": True}

# Dashboard
@app.get("/api/dashboard/summary")
def dashboard_summary(account_id: int, user=Depends(require_auth)):
    stats = calc_account_stats(account_id)
    if stats is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return stats

@app.get("/api/dashboard/holdings")
def dashboard_holdings(account_id: int, user=Depends(require_auth)):
    stats = calc_account_stats(account_id)
    if stats is None:
        raise HTTPException(status_code=404, detail="Account not found")
    return {
        "holdings": stats["holdings"],
        "total_cost": stats["current_holdings_cost"]
    }

@app.get("/api/dashboard/profits")
def dashboard_profits(account_id: int, user=Depends(require_auth)):
    with get_db() as conn:
        rows = conn.execute("""
            SELECT p.name as product_name, COALESCE(SUM(t.profit), 0) as total_profit
            FROM trades t
            JOIN products p ON t.product_id = p.id
            WHERE t.account_id = ? AND t.direction = 'sell'
            GROUP BY t.product_id
            ORDER BY total_profit DESC
        """, (account_id,)).fetchall()
        return [dict(r) for r in rows]

# Static files must be mounted last and catch-all
app.mount("/", StaticFiles(directory="static", html=True), name="static")

if __name__ == "__main__":
    init_db()
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
