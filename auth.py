import os
import secrets
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()
PASSWORD = os.getenv("TRADE_LEDGER_PASSWORD")
if not PASSWORD:
    raise RuntimeError("TRADE_LEDGER_PASSWORD must be set")

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
