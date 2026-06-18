const DashboardPage = {
  setup() {
    const global = Vue.inject('global');
    const summary = Vue.ref(null);
    const holdings = Vue.ref([]);
    const profits = Vue.ref([]);
    const recentTrades = Vue.ref([]);
    let chartInstance = null;
    let profitChartInstance = null;

    const loadData = async () => {
      if (!global.currentAccountId) return;
      try {
        summary.value = await $api.getSummary(global.currentAccountId);
        const h = await $api.getHoldings(global.currentAccountId);
        holdings.value = h.holdings || [];
        profits.value = await $api.getProfits(global.currentAccountId);
        const trades = await $api.getTrades({ account_id: global.currentAccountId, limit: 5 });
        recentTrades.value = trades.slice(0, 5);
        renderChart();
        renderProfitChart();
      } catch (e) {
        console.error(e);
      }
    };

    const renderChart = () => {
      const ctx = document.getElementById('holdingsChart');
      if (!ctx) return;
      if (chartInstance) { chartInstance.destroy(); }
      const labels = holdings.value.map(h => h.product_name);
      const data = holdings.value.map(h => h.cost);
      const colors = ['#2563eb','#16a34a','#d97706','#dc2626','#7c3aed','#0891b2','#be123c','#4338ca'];
      chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } } }
        }
      });
    };

    const renderProfitChart = () => {
      const ctx = document.getElementById('profitChart');
      if (!ctx) return;
      if (profitChartInstance) { profitChartInstance.destroy(); }
      const labels = profits.value.map(p => p.product_name);
      const data = profits.value.map(p => p.total_profit);
      const bgColors = profits.value.map(p => p.total_profit >= 0 ? 'rgba(220,38,38,0.8)' : 'rgba(22,163,74,0.8)');
      profitChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{ data, backgroundColor: bgColors, borderRadius: 6, borderSkipped: false }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              grid: { color: '#e5e7eb' },
              ticks: { callback: v => v.toLocaleString('zh-CN', { minimumFractionDigits: 0 }) }
            }
          }
        }
      });
    };

    const fmt = (n) => (n == null ? '-' : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    Vue.watch(() => global.currentAccountId, loadData, { immediate: true });

    return { global, summary, holdings, profits, recentTrades, fmt };
  },
  template: `
    <div class="page-content">
      <div class="app-header">
        <h1>TradeLedger <span v-if="global.role === 'guest'" style="font-size:0.7rem;color:var(--warning);vertical-align:middle;">访客</span></h1>
        <select class="account-select" v-model="global.currentAccountId">
          <option v-for="a in global.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
      </div>
      <div class="container">
        <div class="card">
          <div class="card-title">资金总览</div>
          <div class="summary-grid" v-if="summary">
            <div class="summary-item">
              <div class="label">初始上限</div>
              <div class="value">{{ fmt(summary.initial_capital) }}</div>
            </div>
            <div class="summary-item">
              <div class="label">已实现盈亏</div>
              <div class="value" :class="summary.realized_profit >= 0 ? 'positive' : 'negative'">{{ fmt(summary.realized_profit) }}</div>
            </div>
            <div class="summary-item">
              <div class="label">持仓成本</div>
              <div class="value">{{ fmt(summary.current_holdings_cost) }}</div>
            </div>
            <div class="summary-item">
              <div class="label">总手续费</div>
              <div class="value">{{ fmt(summary.total_fees) }}</div>
            </div>
            <div class="summary-item">
              <div class="label">可用闲钱</div>
              <div class="value">{{ fmt(summary.available) }}</div>
            </div>
          </div>
        </div>

        <div class="card" v-if="holdings.length">
          <div class="card-title">持仓分布</div>
          <div class="chart-container">
            <canvas id="holdingsChart"></canvas>
          </div>
        </div>

        <div class="card" v-if="holdings.length">
          <div class="card-title">持仓数量</div>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid var(--border);">
                  <th style="text-align: left; padding: 8px 12px;">品种</th>
                  <th style="text-align: right; padding: 8px 12px;">数量</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="h in holdings" :key="h.product_id" style="border-bottom: 1px solid var(--border);">
                  <td style="padding: 8px 12px;">{{ h.product_name }}</td>
                  <td style="text-align: right; padding: 8px 12px;">{{ h.quantity }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" v-if="profits.length">
          <div class="card-title">品种盈亏</div>
          <div class="chart-container" style="height: 300px;">
            <canvas id="profitChart"></canvas>
          </div>
        </div>

        <div class="card">
          <div class="card-title">最近交易</div>
          <div v-if="!recentTrades.length" style="color: var(--text-secondary);">暂无交易记录</div>
          <div class="trade-list" v-else>
            <div class="trade-item" v-for="t in recentTrades" :key="t.id">
              <div class="row">
                <div>
                  <span class="badge" :class="t.direction === 'buy' ? 'badge-buy' : 'badge-sell'">
                    {{ t.direction === 'buy' ? '买入' : '卖出' }}
                  </span>
                  <strong style="margin-left: 8px;">{{ t.product_name }}</strong>
                </div>
                <div class="text-right">
                  <div>{{ t.amount.toLocaleString('zh-CN', {minimumFractionDigits:2}) }}</div>
                  <div style="font-size: 0.8rem; color: var(--text-secondary);">{{ t.trade_date }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <nav class="bottom-nav">
        <router-link to="/" active-class="active"><span class="icon">&#8962;</span>首页</router-link>
        <router-link to="/trades" active-class="active"><span class="icon">&#9776;</span>记录</router-link>
        <router-link to="/trades/buy" active-class="active"><span class="icon">+</span>买入</router-link>
        <router-link to="/trades/sell" active-class="active"><span class="icon">-</span>卖出</router-link>
        <router-link to="/accounts" active-class="active"><span class="icon">&#9638;</span>账户</router-link>
        <router-link to="/settings" active-class="active"><span class="icon">&#9881;</span>设置</router-link>
      </nav>
    </div>
  `
};
