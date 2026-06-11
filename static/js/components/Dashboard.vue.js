const DashboardPage = {
  setup() {
    const global = Vue.inject('global');
    const summary = Vue.ref(null);
    const holdings = Vue.ref([]);
    const recentTrades = Vue.ref([]);
    let chartInstance = null;

    const loadData = async () => {
      if (!global.currentAccountId) return;
      try {
        summary.value = await $api.getSummary(global.currentAccountId);
        const h = await $api.getHoldings(global.currentAccountId);
        holdings.value = h.holdings || [];
        const trades = await $api.getTrades({ account_id: global.currentAccountId, limit: 5 });
        recentTrades.value = trades.slice(0, 5);
        renderChart();
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
          datasets: [{
            data,
            backgroundColor: colors,
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } }
          }
        }
      });
    };

    Vue.watch(() => global.currentAccountId, loadData, { immediate: true });

    const fmt = (n) => (n == null ? '-' : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    return { global, summary, holdings, recentTrades, fmt };
  },
  template: `
    <div class="page-content">
      <div class="app-header">
        <h1>TradeLedger</h1>
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
