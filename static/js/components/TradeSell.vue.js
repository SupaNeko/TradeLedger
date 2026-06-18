const TradeSellPage = {
  setup() {
    const global = Vue.inject('global');
    const form = Vue.reactive({
      account_id: global.currentAccountId,
      product_id: '',
      price: '',
      quantity: '',
      amount: '',
      fee: 0,
      platform: '',
      remark: '',
      trade_date: new Date().toISOString().slice(0, 10)
    });
    const positions = Vue.ref([]);
    const loading = Vue.ref(false);
    const error = Vue.ref('');
    const success = Vue.ref('');
    const profit = Vue.ref(null);

    const loadPositions = async () => {
      if (!form.account_id) return;
      const stats = await $api.getSummary(form.account_id);
      positions.value = stats.holdings || [];
    };

    Vue.watch(() => form.account_id, () => { form.product_id = ''; loadPositions(); });
    Vue.watch(() => global.currentAccountId, (v) => { form.account_id = v; loadPositions(); });

    const selectedPosition = Vue.computed(() => {
      return positions.value.find(p => p.product_id === parseInt(form.product_id)) || null;
    });

    const estimatedProfit = Vue.computed(() => {
      const p = parseFloat(form.price);
      const q = parseFloat(form.quantity);
      if (!selectedPosition.value || !p || !q) return null;
      return (p - selectedPosition.value.avg_cost) * q - parseFloat(form.fee || 0);
    });

    const calcAmount = () => {
      const p = parseFloat(form.price);
      const q = parseFloat(form.quantity);
      if (p > 0 && q > 0) form.amount = (p * q).toFixed(2);
    };
    const calcQuantity = () => {
      const p = parseFloat(form.price);
      const a = parseFloat(form.amount);
      if (p > 0 && a > 0) form.quantity = (a / p).toFixed(4);
    };

    const submit = async () => {
      error.value = ''; success.value = ''; loading.value = true;
      try {
        const payload = {
          account_id: form.account_id,
          product_id: parseInt(form.product_id),
          price: parseFloat(form.price),
          quantity: parseFloat(form.quantity),
          amount: parseFloat(form.amount),
          fee: parseFloat(form.fee || 0),
          platform: form.platform,
          remark: form.remark,
          trade_date: form.trade_date
        };
        const res = await $api.sell(payload);
        profit.value = res.profit;
        success.value = '卖出成功';
        form.price = ''; form.quantity = ''; form.amount = ''; form.fee = 0; form.platform = ''; form.remark = '';
        await loadPositions();
      } catch (e) {
        error.value = e.message || '保存失败';
      } finally {
        loading.value = false;
      }
    };

    Vue.onMounted(loadPositions);

    return { global, form, positions, selectedPosition, estimatedProfit, loading, error, success, profit, calcAmount, calcQuantity, submit };
  },
  template: `
    <div class="page-content">
      <div class="app-header">
        <h1>卖出</h1>
        <select class="account-select" v-model="global.currentAccountId" @change="form.account_id = global.currentAccountId">
          <option v-for="a in global.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
      </div>
      <div class="container">
        <div v-if="global.role !== 'admin'" class="card" style="text-align:center; color:var(--text-secondary); padding:40px;">
          访客模式，无法录入交易
        </div>
        <div class="card" v-else>
          <div class="form-group">
            <label>品种</label>
            <select class="form-control" v-model="form.product_id">
              <option value="">请选择品种</option>
              <option v-for="p in positions" :key="p.product_id" :value="p.product_id">{{ p.product_name }} (持仓: {{ p.quantity.toFixed(4) }}, 成本: {{ p.avg_cost.toFixed(4) }})</option>
            </select>
          </div>
          <div v-if="selectedPosition" style="background: var(--bg); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 0.9rem;">
            <div>当前持仓: <strong>{{ selectedPosition.quantity.toFixed(4) }}</strong></div>
            <div>平均成本: <strong>{{ selectedPosition.avg_cost.toFixed(4) }}</strong></div>
          </div>
          <div class="form-group">
            <label>卖出单价</label>
            <input type="number" class="form-control" v-model="form.price" placeholder="单价" @input="calcAmount">
          </div>
          <div class="form-group">
            <label>卖出数量</label>
            <input type="number" class="form-control" v-model="form.quantity" placeholder="数量" @input="calcAmount">
          </div>
          <div class="form-group">
            <label>金额</label>
            <input type="number" class="form-control" v-model="form.amount" placeholder="金额" @input="calcQuantity">
          </div>
          <div class="form-group">
            <label>手续费</label>
            <input type="number" class="form-control" v-model="form.fee" placeholder="0">
          </div>
          <div v-if="estimatedProfit !== null" style="margin-bottom: 16px; font-size: 0.95rem;">
            预估盈亏: <strong :style="{color: estimatedProfit >= 0 ? 'var(--danger)' : 'var(--success)'}">{{ estimatedProfit.toFixed(2) }}</strong>
          </div>
          <div class="form-group">
            <label>平台</label>
            <input type="text" class="form-control" v-model="form.platform" placeholder="如：券商A">
          </div>
          <div class="form-group">
            <label>备注</label>
            <input type="text" class="form-control" v-model="form.remark">
          </div>
          <div class="form-group">
            <label>日期</label>
            <input type="date" class="form-control" v-model="form.trade_date">
          </div>
          <div v-if="error" style="color: var(--danger); margin-bottom: 12px;">{{ error }}</div>
          <div v-if="success" style="margin-bottom: 12px;">{{ success }}，本笔盈亏: <span :style="{color: profit >= 0 ? 'var(--danger)' : 'var(--success)'}">{{ profit.toFixed(2) }}</span></div>
          <button class="btn btn-primary btn-block" :disabled="loading" @click="submit">保存卖出</button>
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
