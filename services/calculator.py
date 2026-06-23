from database import get_db

def get_trades_for_account_product(account_id: int, product_id: int):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM trades WHERE account_id=? AND product_id=? ORDER BY trade_date, id",
            (account_id, product_id)
        ).fetchall()
        return [dict(r) for r in rows]

def calc_position(account_id: int, product_id: int):
    """Returns (hold_qty, avg_cost) for a product."""
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
                hold_qty = 0.0
    return hold_qty, avg_cost

def calc_account_stats(account_id: int):
    with get_db() as conn:
        rows = conn.execute(
            "SELECT DISTINCT product_id FROM trades WHERE account_id=?",
            (account_id,)
        ).fetchall()
        product_ids = [r["product_id"] for r in rows]

    with get_db() as conn:
        fees = conn.execute("SELECT COALESCE(SUM(fee),0) as s FROM trades WHERE account_id=?", (account_id,)).fetchone()["s"]
        profit = conn.execute(
            "SELECT COALESCE(SUM(profit),0) as s FROM trades WHERE account_id=? AND direction='sell'", (account_id,)
        ).fetchone()["s"]
        initial = conn.execute("SELECT initial_capital FROM accounts WHERE id=?", (account_id,)).fetchone()
        if not initial:
            return None
        initial = initial["initial_capital"]

    realized_profit = profit or 0.0
    total_fees = fees or 0.0
    current_holdings_cost = 0.0
    holdings = []

    for pid in product_ids:
        qty, avg = calc_position(account_id, pid)
        if qty > 0:
            with get_db() as conn:
                prod = conn.execute("SELECT name, remark FROM products WHERE id=?", (pid,)).fetchone()
            name = prod["name"] if prod else ""
            remark = prod["remark"] if prod else ""
            cost = qty * avg
            holdings.append({
                "product_id": pid,
                "product_name": name,
                "remark": remark,
                "quantity": qty,
                "avg_cost": avg,
                "cost": cost
            })
            current_holdings_cost += cost

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
    if stats is None:
        return False, "账户不存在"
    if amount + fee > stats["available"] + 1e-9:
        return False, f"可用闲钱不足，当前可用: {stats['available']:.2f}"
    return True, ""

def validate_sell(account_id: int, product_id: int, quantity: float):
    hold_qty, avg_cost = calc_position(account_id, product_id)
    if quantity > hold_qty + 1e-9:
        return False, f"持仓不足，当前持仓: {hold_qty:.4f}", 0.0
    return True, "", avg_cost
