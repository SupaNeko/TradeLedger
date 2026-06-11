const AccountsPage = {
  setup() {
    const global = Vue.inject('global');
    const accounts = Vue.ref([]);
    const showModal = Vue.ref(false);
    const editing = Vue.ref(null);
    const form = Vue.reactive({ name: '', initial_capital: '' });

    const load = async () => {
      accounts.value = await $api.getAccounts();
    };

    const openCreate = () => {
      editing.value = null;
      form.name = ''; form.initial_capital = '';
      showModal.value = true;
    };
    const openEdit = (acc) => {
      editing.value = acc;
      form.name = acc.name; form.initial_capital = acc.initial_capital;
      showModal.value = true;
    };
    const save = async () => {
      if (editing.value) {
        await $api.updateAccount(editing.value.id, { name: form.name, initial_capital: parseFloat(form.initial_capital) });
      } else {
        await $api.createAccount({ name: form.name, initial_capital: parseFloat(form.initial_capital) });
      }
      showModal.value = false;
      await load();
    };
    const remove = async (id) => {
      if (!confirm('确定删除该账户？所有交易记录也将被删除。')) return;
      await $api.deleteAccount(id);
      await load();
    };

    const fmt = (n) => (n == null ? '-' : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    Vue.onMounted(load);

    return { global, accounts, showModal, editing, form, openCreate, openEdit, save, remove, fmt };
  },
  template: `
    <div class="page-content">
      <div class="app-header">
        <h1>账户管理</h1>
      </div>
      <div class="container">
        <button class="btn btn-primary btn-block mb-2" @click="openCreate">+ 新建账户</button>
        <div v-if="!accounts.length" style="color: var(--text-secondary); text-align: center; padding: 40px;">暂无账户</div>
        <div class="trade-list" v-else>
          <div class="trade-item" v-for="a in accounts" :key="a.id">
            <div class="row">
              <strong>{{ a.name }}</strong>
              <div class="text-right" style="font-size: 0.85rem; color: var(--text-secondary);">初始上限: {{ fmt(a.initial_capital) }}</div>
            </div>
            <div class="row" style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px;">
              <div>持仓: {{ fmt(a.current_holdings_cost) }}</div>
              <div>已实现盈亏: <span :style="{color: a.realized_profit >= 0 ? 'var(--success)' : 'var(--danger)'}">{{ fmt(a.realized_profit) }}</span></div>
            </div>
            <div class="row" style="font-size: 0.85rem; color: var(--text-secondary);">
              <div>可用: {{ fmt(a.available) }}</div>
              <div>手续费: {{ fmt(a.total_fees) }}</div>
            </div>
            <div class="row flex gap-2" style="margin-top: 10px;">
              <button class="btn btn-outline" style="padding: 6px 12px; font-size: 0.85rem; flex:1;" @click="openEdit(a)">编辑</button>
              <button class="btn btn-danger" style="padding: 6px 12px; font-size: 0.85rem; flex:1;" @click="remove(a.id)">删除</button>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-overlay" v-if="showModal" @click.self="showModal = false">
        <div class="modal-content">
          <h3 style="margin: 0 0 16px 0;">{{ editing ? '编辑账户' : '新建账户' }}</h3>
          <div class="form-group">
            <label>账户名称</label>
            <input type="text" class="form-control" v-model="form.name">
          </div>
          <div class="form-group">
            <label>资金上限</label>
            <input type="number" class="form-control" v-model="form.initial_capital">
          </div>
          <div class="flex gap-2">
            <button class="btn btn-outline btn-block" @click="showModal = false">取消</button>
            <button class="btn btn-primary btn-block" @click="save">保存</button>
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
