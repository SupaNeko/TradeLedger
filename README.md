# TradeLedger

个人投资盈亏手动记录系统。支持多账户隔离、品种分类管理、买入卖出记录、平均成本法自动计算持仓与盈亏，以及资金上限管理。

---

## 功能

- **买入记录**：记录产品品种、单价、数量（或根据总额与单价自动计算数量）、平台、手续费、备注、日期。
- **卖出记录**：品种只能从当前持仓中选择，自动校验卖出数量不超过持有数量，手动填写卖出单价，自动计算该笔盈亏。
- **盈亏与持仓统计**：按平均成本法实时计算每个品种的持仓数量、平均成本、已实现盈亏，并绘制持仓成本饼图。
- **账户隔离**：多个独立账户，数据互不相关。每个账户可单独设置资金上限。
- **资金上限管理**：买入时校验（金额 + 手续费）不超过当前可用闲钱。可用闲钱 = 初始资金上限 + 历史已实现盈亏 - 当前持仓总成本 - 历史总手续费。
- **品种分类**：支持一级分类（如股票、基金、加密货币等），买入/卖出时可按分类筛选品种。
- **密码保护**：通过环境变量设置访问密码，登录后方可查看和操作数据。
- **访客模式**：通过独立环境变量 `TRADE_LEDGER_GUEST_PASSWORD` 设置访客密码，访客只能查看数据，无法记录买卖、修改设置或新增账户。
- **移动端适配**：响应式布局，支持手机浏览器访问。

---

## 技术栈

- **后端**：Python 3.10+、FastAPI、Uvicorn、SQLite
- **前端**：Vue 3（CDN）、Vue Router、Chart.js、原生响应式 CSS

---

## 安装

```bash
git clone <仓库地址>
cd TradeLedger
pip install -r requirements.txt
```

创建 `.env` 文件：

```
TRADE_LEDGER_PASSWORD=你的管理员密码
TRADE_LEDGER_GUEST_PASSWORD=你的访客密码
```

> `TRADE_LEDGER_GUEST_PASSWORD` 为可选项。不设置时无访客模式。

---

## 启动

### 生产模式

```bash
# Linux / macOS
export TRADE_LEDGER_PASSWORD="你的管理员密码"
export TRADE_LEDGER_GUEST_PASSWORD="你的访客密码"   # 可选
python main.py

# Windows PowerShell
$env:TRADE_LEDGER_PASSWORD="你的管理员密码"
$env:TRADE_LEDGER_GUEST_PASSWORD="你的访客密码"    # 可选
python main.py
```

默认监听 `0.0.0.0:8000`，启动后通过浏览器访问 `http://服务器IP:8000`。

生产环境建议配合 Nginx 反向代理并启用 HTTPS：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 开发模式

开发模式与生产模式启动方式相同，代码修改后需手动重启服务。如需热重载，可使用 Uvicorn 的 `--reload` 参数：

```bash
# Linux / macOS
export TRADE_LEDGER_PASSWORD="你的管理员密码"
export TRADE_LEDGER_GUEST_PASSWORD="你的访客密码"   # 可选
uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Windows PowerShell
$env:TRADE_LEDGER_PASSWORD="你的管理员密码"
$env:TRADE_LEDGER_GUEST_PASSWORD="你的访客密码"    # 可选
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> 注意：`--reload` 仅重启后端代码，前端静态文件修改后刷新浏览器即可生效，无需重启。

---

## 数据说明

- 数据库使用 SQLite，数据文件为项目目录下的 `tradeledger.db`。
- 备份只需复制 `tradeledger.db` 文件。
- 删除 `tradeledger.db` 后下次启动会自动重建空数据库（保留默认分类"其它"）。

---

## 项目结构

```
TradeLedger/
├── main.py              # FastAPI 入口，挂载静态文件
├── auth.py              # 密码验证与 Cookie Session
├── database.py          # SQLite 连接与表初始化
├── models.py            # Pydantic 请求/响应模型
├── requirements.txt     # Python 依赖
├── .env                 # 环境变量（密码）
├── services/
│   └── calculator.py    # 平均成本、盈亏、资金计算核心逻辑
└── static/              # 前端文件（由 FastAPI 直接托管）
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js
        ├── app.js
        ├── router.js
        └── components/     # Vue 页面组件
```

---

## 核心算法

### 平均成本法（滚动计算）

- **买入**：`avg_cost = (avg_cost * hold_qty + price * qty + fee) / (hold_qty + qty)`
- **卖出**：`profit = (sell_price - avg_cost) * sell_qty - sell_fee`，`hold_qty` 减少，`avg_cost` 不变
- **清仓后再次买入**：平均成本重新计算

### 可用闲钱

```
available = initial_capital + realized_profit - current_holdings_cost - total_fees
```

---

## 浏览器支持

- Chrome / Edge / Firefox / Safari 最新版
- 手机浏览器（iOS Safari、Android Chrome）

---

## License

MIT
