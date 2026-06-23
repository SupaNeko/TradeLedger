from pydantic import BaseModel
from typing import Optional
from datetime import date

class AccountCreate(BaseModel):
    name: str
    initial_capital: float

class AccountUpdate(BaseModel):
    name: Optional[str] = None
    initial_capital: Optional[float] = None

class CategoryCreate(BaseModel):
    name: str

class ProductCreate(BaseModel):
    category_id: int
    name: str

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

class TradeUpdate(BaseModel):
    remark: Optional[str] = None

class LoginPayload(BaseModel):
    password: str
