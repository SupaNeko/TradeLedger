import os
import secrets
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()
PASSWORD = os.getenv("TRADE_LEDGER_PASSWORD")
if not PASSWORD:
    raise RuntimeError("TRADE_LEDGER_PASSWORD must be set")

GUEST_PASSWORD = os.getenv("TRADE_LEDGER_GUEST_PASSWORD", "")

SESSIONS = {}

def check_password(password: str) -> str | None:
    if secrets.compare_digest(password, PASSWORD):
        return "admin"
    if GUEST_PASSWORD and secrets.compare_digest(password, GUEST_PASSWORD):
        return "guest"
    return None

def create_session(role: str) -> str:
    token = secrets.token_urlsafe(32)
    SESSIONS[token] = role
    return token

def delete_session(token: str):
    SESSIONS.pop(token, None)

def require_auth(request: Request) -> str:
    token = request.cookies.get("tradeledger_session")
    if not token or token not in SESSIONS:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return SESSIONS[token]

def require_admin(request: Request) -> str:
    role = require_auth(request)
    if role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Guest cannot perform this action")
    return role
