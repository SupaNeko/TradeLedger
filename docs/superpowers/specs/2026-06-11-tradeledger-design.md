# TradeLedger 投资盈亏记录系统 — 设计文档

**日期**: 2026-06-11
**状态**: 已批准

---

## 1. 需求摘要

构建一个 Web 应用，用于个人自定义记录投资盈亏。核心能力包括：

1. **买入记录**: 记录产品品种、单价、数量（或根据总额与单价自动算数量）、备注、日期、平台、手续费（可选，默认 0）。
2. **卖出记录**: 品种只能从已有持仓选择；卖出数量/金额不得大于持有；单价手动填写；自动计算该笔盈亏。
3. **盈亏与持仓统计**: 按平均成本法计算每个品种当前持仓、已实现盈亏；绘制持仓成本饼图。
4. **账户隔离**: 多个独立账户，数据互不相关。
5. **资金上限管理**: 每个账户预设资金上限（可修改）。买入时总金额+手续费不能超过当前可用闲钱。可用闲钱 = 初始资金上限 + 历史已实现盈亏 - 当前持仓总成本 - 历史总手续费。
6. **Web 访问 + 移动端适配**: Linux 部署后通过浏览器访问；样式适配手机端。
7. **密码保护**: 通过环境变量 `TRADE_LEDGER_PASSWORD` 设置访问密码，登录后方可操作。

---

## 2. 技术架构

- **后端**: Python 3.10+ + FastAPI + Uvicorn
- **数据库**: SQLite（单文件，零配置）
- **前端**: Vue 3（CDN 引入）+ Vue Router（Hash 模式，CDN）+ Chart.js（CDN）+ 自定义响应式 CSS
- **部署**: Linux 直接运行 `python main.py`，监听 `0.0.0.0:8000`；Nginx 反向代理可选
- **安全**: 环境变量 `TRADE_LEDGER_PASSWORD`；登录后写入 httpOnly Cookie（token）；后续请求校验 Cookie

**项目结构**:

```
TradeLedger/
├── main.py              # FastAPI 入口，挂载静态文件
├── requirements.txt     # Python 依赖
├── .env                 # TRADE_LEDGER_PASSWORD=xxx
├── database.py          # SQLite 连接、初始化、Migration
├── models.py            # Pydantic 请求/响应模型
├── auth.py              # 密码验证、Cookie Token 逻辑
├── routers/
│   ├── accounts.py      # 账户 CRUD、资金上限
│   ├── categories.py    # 品种分类
│   ├── products.py      # 品种管理
│   ├── trades.py        # 买入/卖出记录
│   └── dashboard.py     # 统计、饼图数据
├── services/
│   └── calculator.py    # 平均成本、盈亏、资金计算
└── static/              # 前端文件（由 FastAPI 托管）
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        ├── app.js       # Vue 应用入口
        ├── router.js    # 前端路由
        ├── api.js       # 封装 fetch + Cookie
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

## 3. 数据模型（SQLite）

### 3.1 accounts（账户）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增 |
| name | TEXT | 账户名称，如"账户A" |
| initial_capital | REAL | 资金上限初始值 |
| created_at | TEXT | ISO 8601 时间戳 |

### 3.2 categories（分类）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增 |
| name | TEXT | 分类名称，如"股票"、"基金"、"加密货币"、"其它" |

### 3.3 products（品种）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增 |
| category_id | INTEGER FK → categories.id | 所属分类 |
| name | TEXT | 品种名称，如"贵州茅台" |

### 3.4 trades（交易记录）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER PK | 自增 |
| account_id | INTEGER FK → accounts.id | 所属账户 |
| product_id | INTEGER FK → products.id | 品种 |
| direction | TEXT | 'buy' 或 'sell' |
| price | REAL | 单价 |
| quantity | REAL | 数量（支持小数） |
| amount | REAL | 总金额 |
| fee | REAL | 手续费，默认 0 |
| platform | TEXT | 交易平台 |
| remark | TEXT | 备注 |
| trade_date | TEXT | 交易日期，YYYY-MM-DD |
| profit | REAL | 仅卖出时有值，该笔卖出盈亏 |
| created_at | TEXT | ISO 8601 时间戳 |

**持仓不单独建表**，通过 `trades` 实时聚合计算。

---

## 4. 核心算法

### 4.1 平均成本法（滚动计算）
对某个账户的某个品种，按时间顺序遍历交易：

- 初始：`avg_cost = 0`, `hold_qty = 0`
- 买入：`avg_cost = (avg_cost * hold_qty + price * qty + fee) / (hold_qty + qty)`；`hold_qty += qty`
- 卖出：`profit = (sell_price - avg_cost) * sell_qty - sell_fee`；`hold_qty -= sell_qty`；`avg_cost` 不变
- 全部卖完：`avg_cost = 0`

### 4.2 可用闲钱
```
realized_profit = SUM(trades.profit WHERE direction='sell')
current_holdings_cost = SUM(各品种 hold_qty * avg_cost)
total_fees = SUM(trades.fee)
available = initial_capital + realized_profit - current_holdings_cost - total_fees
```

### 4.3 买入校验
买入时：`(amount + fee)` 必须 ≤ `available`，否则拒绝并返回 400。

### 4.4 卖出校验
卖出时：`sell_qty` 必须 ≤ 该品种当前 `hold_qty`，否则拒绝并返回 400。

---

## 5. 后端 API

所有 API 前缀 `/api`，返回 JSON。未登录返回 401。

### 认证
| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/login` | {password} → 设置 Cookie token |
| POST | `/api/auth/logout` | 清除 Cookie |
| GET | `/api/auth/me` | 检查登录状态 |

### 账户
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/accounts` | 列表（含实时统计） |
| POST | `/api/accounts` | 新建 |
| PUT | `/api/accounts/{id}` | 修改名称/初始上限 |
| DELETE | `/api/accounts/{id}` | 删除（级联删交易） |

### 分类
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/categories` | 列表 |
| POST | `/api/categories` | 新建 |
| DELETE | `/api/categories/{id}` | 删除（仅当无品种关联时） |

### 品种
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/products?category_id=` | 列表，可按分类筛选 |
| POST | `/api/products` | 新建 |
| DELETE | `/api/products/{id}` | 删除（仅当无交易关联时） |

### 交易
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/trades?account_id=&product_id=&category_id=&direction=` | 列表，多维度筛选 |
| POST | `/api/trades/buy` | 买入（校验闲钱） |
| POST | `/api/trades/sell` | 卖出（校验持仓） |
| DELETE | `/api/trades/{id}` | 删除记录 |

### 仪表盘
| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/dashboard/summary?account_id=` | 账户总览 |
| GET | `/api/dashboard/holdings?account_id=` | 持仓明细（用于饼图） |

---

## 6. 前端设计

### 6.1 技术
- Vue 3（Global Build CDN）
- Vue Router 4（Hash 模式 CDN）
- Chart.js 4（CDN）
- 无构建工具，手写响应式 CSS

### 6.2 页面路由
| 路由 | 页面 | 说明 |
|---|---|---|
| `/login` | 登录页 | 密码输入框，验证后跳转 |
| `/` | 仪表盘 | 账户切换Tab、资金总览卡片、持仓饼图、最近交易 |
| `/trades` | 交易记录 | 列表、筛选、删除 |
| `/trades/buy` | 买入录入 | 表单，单价/数量/金额三选二自动计算 |
| `/trades/sell` | 卖出录入 | 表单，选品种后反显持仓和平均成本，实时预估盈亏 |
| `/accounts` | 账户管理 | 新建/编辑/删除账户，修改初始上限 |
| `/settings` | 设置 | 分类管理、品种管理 |

### 6.3 移动端适配要点
- 视口 `<meta name="viewport" content="width=device-width, initial-scale=1">`
- 按钮最小高度 44px，字体不小于 14px
- 表单输入框 100% 宽度
- 卡片布局使用 Flexbox/Grid，小屏幕自动单列
- 底部固定导航栏（手机端）或左侧边栏（PC端）

---

## 7. 安全设计

- 环境变量 `TRADE_LEDGER_PASSWORD` 为唯一访问凭证
- 启动时若未设置密码，打印警告并拒绝启动（或生成随机密码并打印在日志中）
- 登录成功后，服务端生成随机 token，写入 httpOnly Cookie（如 `tradeledger_session`）
- 受保护路由检查 Cookie token 是否匹配服务端内存中的有效 token（单机部署，内存存储足够）
- 登出时清除 Cookie 并使 token 失效

---

## 8. 部署说明

```bash
pip install -r requirements.txt
TRADE_LEDGER_PASSWORD=your_secret python main.py
```

默认监听 `0.0.0.0:8000`。生产环境建议配合 Nginx 反向代理，并启用 HTTPS。

---

## 9. 风险与注意事项

- **删除交易记录**：删除中间的买入记录会导致后续平均成本计算结果变化。系统允许删除，但需谨慎。
- **平均成本法局限**：若持仓为 0 后再次买入，平均成本重新计算，与之前的卖出盈亏无关，符合预期。
- **资金上限修改**：修改 `initial_capital` 后，可用闲钱立即变化，可能影响后续买入校验。
