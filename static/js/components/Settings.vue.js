const SettingsPage = {
  setup() {
    const tab = Vue.ref('categories');
    const categories = Vue.ref([]);
    const products = Vue.ref([]);
    const catFilter = Vue.ref('');
    const newCategory = Vue.ref('');
    const newProduct = Vue.reactive({ category_id: '', name: '', remark: '' });
    const editingProductId = Vue.ref(null);
    const editProductRemark = Vue.ref('');

    const loadCategories = async () => {
      categories.value = await $api.getCategories();
    };
    const loadProducts = async () => {
      products.value = await $api.getProducts(catFilter.value || undefined);
    };

    Vue.watch(catFilter, loadProducts);

    const addCategory = async () => {
      if (!newCategory.value.trim()) return;
      await $api.createCategory({ name: newCategory.value.trim() });
      newCategory.value = '';
      await loadCategories();
    };
    const removeCategory = async (id) => {
      if (!confirm('确定删除此分类？')) return;
      try {
        await $api.deleteCategory(id);
        await loadCategories();
      } catch (e) {
        alert(e.message);
      }
    };

    const addProduct = async () => {
      if (!newProduct.category_id || !newProduct.name.trim()) return;
      await $api.createProduct({ category_id: parseInt(newProduct.category_id), name: newProduct.name.trim(), remark: newProduct.remark.trim() });
      newProduct.name = '';
      newProduct.remark = '';
      await loadProducts();
    };
    const updateProductRemark = async (p) => {
      if (editingProductId.value !== p.id) return;
      try {
        await $api.updateProduct(p.id, { remark: editProductRemark.value });
        p.remark = editProductRemark.value;
      } catch (e) {
        console.error(e);
      }
      editingProductId.value = null;
    };
    const startEditProduct = (p) => {
      editingProductId.value = p.id;
      editProductRemark.value = p.remark || '';
    };
    const cancelEditProduct = () => {
      editingProductId.value = null;
      editProductRemark.value = '';
    };
    const removeProduct = async (id) => {
      if (!confirm('确定删除此品种？')) return;
      try {
        await $api.deleteProduct(id);
        await loadProducts();
      } catch (e) {
        alert(e.message);
      }
    };

    Vue.onMounted(() => { loadCategories(); loadProducts(); });

    const global = Vue.inject('global');
    return { global, tab, categories, products, catFilter, newCategory, newProduct, addCategory, removeCategory, addProduct, removeProduct, editingProductId, editProductRemark, startEditProduct, updateProductRemark, cancelEditProduct };
  },
  template: `
    <div class="page-content">
      <div class="app-header">
        <h1>设置</h1>
      </div>
      <div class="container">
        <div class="flex gap-2 mb-2">
          <button class="btn" :class="tab==='categories' ? 'btn-primary' : 'btn-outline'" @click="tab='categories'" style="flex:1;">分类管理</button>
          <button class="btn" :class="tab==='products' ? 'btn-primary' : 'btn-outline'" @click="tab='products'" style="flex:1;">品种管理</button>
        </div>

        <div v-if="tab==='categories'">
          <div v-if="global.role === 'admin'" class="card">
            <div class="form-group">
              <label>新建分类</label>
              <div class="flex gap-2">
                <input type="text" class="form-control" v-model="newCategory" placeholder="分类名称" @keyup.enter="addCategory">
                <button class="btn btn-primary" @click="addCategory">添加</button>
              </div>
            </div>
          </div>
          <div class="trade-list">
            <div class="trade-item" v-for="c in categories" :key="c.id">
              <div class="row">
                <strong>{{ c.name }}</strong>
                <button v-if="c.name !== '其它' && global.role === 'admin'" class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem;" @click="removeCategory(c.id)">删除</button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="tab==='products'">
          <div v-if="global.role === 'admin'" class="card">
            <div class="form-group">
              <label>筛选分类</label>
              <select class="form-control" v-model="catFilter">
                <option value="">全部分类</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>新建品种</label>
              <select class="form-control" v-model="newProduct.category_id">
                <option value="">选择分类</option>
                <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.name }}</option>
              </select>
            </div>
            <div class="form-group">
              <div class="flex gap-2">
                <input type="text" class="form-control" v-model="newProduct.name" placeholder="品种名称" @keyup.enter="addProduct">
                <input type="text" class="form-control" v-model="newProduct.remark" placeholder="备注（可选）" @keyup.enter="addProduct" style="flex: 0.8;">
                <button class="btn btn-primary" @click="addProduct">添加</button>
              </div>
            </div>
          </div>
          <div class="trade-list">
            <div class="trade-item" v-for="p in products" :key="p.id">
              <div class="row" style="align-items: flex-start;">
                <div style="flex: 1;">
                  <strong>{{ p.name }}</strong>
                  <div v-if="editingProductId === p.id" style="margin-top: 4px;">
                    <input
                      type="text"
                      class="form-control"
                      v-model="editProductRemark"
                      @blur="updateProductRemark(p)"
                      @keyup.enter="updateProductRemark(p)"
                      @keyup.esc="cancelEditProduct"
                      style="font-size: 0.85rem; padding: 4px 8px;"
                    />
                  </div>
                  <div v-else @click="startEditProduct(p)" style="font-size: 0.85rem; color: var(--text-secondary); cursor: pointer; margin-top: 2px; min-height: 18px;">
                    {{ p.remark || '点击添加备注' }}
                  </div>
                </div>
                <button v-if="global.role === 'admin'" class="btn btn-outline" style="padding: 6px 12px; font-size: 0.8rem; margin-left: 8px; align-self: flex-start;" @click="removeProduct(p.id)">删除</button>
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
