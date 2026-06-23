const TradeListPage = {
  setup() {
    const global = Vue.inject('global');
    const trades = Vue.ref([]);
    const filters = Vue.reactive({
      account_id: global.currentAccountId,
      category_id: '',
      product_id: '',
      direction: ''
    });
    const categories = Vue.ref([]);
    const products = Vue.ref([]);

    const loadCategories = async () => {
      categories.value = await $api.getCategories();
    };
    const loadProducts = async () => {
      products.value = await $api.getProducts(filters.category_id || undefined);
    };
    const loadTrades = async () => {
      const params = { ...filters };
      if (!params.account_id) params.account_id = global.currentAccountId;
      trades.value = await $api.getTrades(params);
    };

    Vue.watch(() => filters.category_id, async () => {
      filters.product_id = '';
      await loadProducts();
      await loadTrades();
    });
    Vue.watch(() => [filters.product_id, filters.direction, global.currentAccountId], loadTrades, { deep: true });

    const remove = async (id) => {
      if (!confirm('确定删除这条记录？')) return;
      await $api.deleteTrade(id);
      await loadTrades();
    };

    const editingId = Vue.ref(null);
    const editRemark = Vue.ref('');

    const startEdit = (t) => {
      editingId.value = t.id;
      editRemark.value = t.remark || '';
      Vue.nextTick(() => {
        const input = document.querySelector(`input[data-edit-id="${t.id}"]`);
        if (input) input.focus();
      });
    };

    const saveRemark = async (t) => {
      if (editingId.value !== t.id) return;
      try {
        await $api.updateTrade(t.id, { remark: editRemark.value });
        t.remark = editRemark.value;
      } catch (e) {
        console.error(e);
      }
      editingId.value = null;
    };

    const cancelEdit = () => {
      editingId.value = null;
      editRemark.value = '';
    };

    Vue.onMounted(async () => {
      await loadCategories();
      await loadProducts();
      await loadTrades();
    });

    return { global, trades, filters, categories, products, remove, editingId, editRemark, startEdit, saveRemark, cancelEdit };
  },
  template: `
    <div class="page-content">
      <div class="app-header">
        <h1>交易记录</h1>
        <select class="account-select" v-model="global.currentAccountId">
          <option v-for="a in global.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
      </div>
      <div class="container">
        <div class="filters">
          <select class="form-control" v-model="filters.category_id">
            <option value="">全部分类</option>
            <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <select class="form-control" v-model="filters.product_id">
            <option value="">全部品种</option>
            <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
          <select class="form-control" v-model="filters.direction">
            <option value="">全部方向</option>
            <option value="buy">买入</option>
            <option value="sell">卖出</option>
          </select>
        </div>
        <div v-if="!trades.length" style="color: var(--text-secondary); text-align: center; padding: 40px;">暂无记录</div>
        <div class="trade-list" v-else>
          <div class="trade-item" v-for="t in trades" :key="t.id">
            <div class="row">
              <div>
                <span class="badge" :class="t.direction === 'buy' ? 'badge-buy' : 'badge-sell'">
                  {{ t.direction === 'buy' ? '买入' : '卖出' }}
                </span>
                <strong style="margin-left: 8px;">{{ t.product_name }}</strong>
                <span style="color: var(--text-secondary); font-size: 0.8rem; margin-left: 6px;">{{ t.category_name }}</span>
              </div>
              <div class="text-right">
                <div style="font-weight: 700;">{{ t.amount.toLocaleString('zh-CN', {minimumFractionDigits:2}) }}</div>
                <div style="font-size: 0.8rem; color: var(--text-secondary);">{{ t.trade_date }}</div>
              </div>
            </div>
            <div class="row" style="font-size: 0.85rem; color: var(--text-secondary);">
              <div>单价: {{ t.price }} × 数量: {{ t.quantity }}</div>
              <div>手续费: {{ t.fee }} <span v-if="t.profit != null" :style="{color: t.profit >= 0 ? 'var(--danger)' : 'var(--success)', marginLeft: '8px'}">盈亏: {{ t.profit.toFixed(2) }}</span></div>
            </div>
            <div class="row" v-if="global.role === 'admin'" style="margin-top: 4px;">
              <div v-if="editingId === t.id" style="display: flex; gap: 8px; align-items: center; width: 100%;">
                <input
                  type="text"
                  class="form-control"
                  v-model="editRemark"
                  @blur="saveRemark(t)"
                  @keyup.enter="saveRemark(t)"
                  @keyup.esc="cancelEdit"
                  style="flex: 1; font-size: 0.85rem; padding: 6px 10px;"
                  :data-edit-id="t.id"
                />
              </div>
              <div v-else @click="startEdit(t)" style="font-size: 0.85rem; color: var(--text-secondary); cursor: pointer; min-height: 20px;">
                {{ t.remark || '点击添加备注' }}
              </div>
            </div>
            <div class="row" v-else-if="t.remark" style="margin-top: 4px;">
              <div style="font-size: 0.85rem; color: var(--text-secondary);">{{ t.remark }}</div>
            </div>
            <div class="row" style="margin-top: 8px;" v-if="global.role === 'admin'">
              <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.85rem;" @click="remove(t.id)">删除</button>
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
