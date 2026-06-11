const TradeBuyPage = {
  setup() {
    const global = Vue.inject('global');
    const form = Vue.reactive({
      account_id: global.currentAccountId,
      category_id: '',
      product_id: '',
      price: '',
      quantity: '',
      amount: '',
      fee: 0,
      platform: '',
      remark: '',
      trade_date: new Date().toISOString().slice(0, 10)
    });
    const categories = Vue.ref([]);
    const products = Vue.ref([]);
    const loading = Vue.ref(false);
    const error = Vue.ref('');
    const success = Vue.ref('');

    const loadCategories = async () => {
      categories.value = await $api.getCategories();
    };
    const loadProducts = async () => {
      products.value = await $api.getProducts(form.category_id || undefined);
    };

    Vue.watch(() => form.category_id, () => {
      form.product_id = '';
      loadProducts();
    });
    Vue.watch(() => global.currentAccountId, (v) => { form.account_id = v; });

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
        await $api.buy(payload);
        success.value = '买入记录已保存';
        form.price = ''; form.quantity = ''; form.amount = ''; form.fee = 0; form.platform = ''; form.remark = '';
      } catch (e) {
        error.value = e.message || '保存失败';
      } finally {
        loading.value = false;
      }
    };

    Vue.onMounted(() => { loadCategories(); loadProducts(); });

    return { global, form, categories, products, loading, error, success, calcAmount, calcQuantity, submit };
  },
  template: `
    <div class="page-content">
      <div class="app-header">
        <h1>买入</h1>
        <select class="account-select" v-model="global.currentAccountId" @change="form.account_id = global.currentAccountId">
          <option v-for="a in global.accounts" :key="a.id" :value="a.id">{{ a.name }}</option>
        </select>
      </div>
      <div class="container">
        <div class="card">
          <div class="form-group">
            <label>分类</label>
            <select class="form-control" v-model="form.category_id">
              <option value="">全部分类</option>
              <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>品种</label>
            <select class="form-control" v-model="form.product_id">
              <option value="">请选择品种</option>
              <option v-for="p in products" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
          <div class="form-group">
            <label>单价</label>
            <input type="number" class="form-control" v-model="form.price" placeholder="单价" @input="calcAmount">
          </div>
          <div class="form-group">
            <label>数量</label>
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
          <div v-if="success" style="color: var(--success); margin-bottom: 12px;">{{ success }}</div>
          <button class="btn btn-primary btn-block" :disabled="loading" @click="submit">保存买入</button>
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
