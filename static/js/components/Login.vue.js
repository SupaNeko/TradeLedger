const LoginPage = {
  setup() {
    const password = Vue.ref('');
    const error = Vue.ref('');
    const loading = Vue.ref(false);

    const submit = async () => {
      error.value = '';
      loading.value = true;
      try {
        await $api.login(password.value);
        window.location.hash = '#/';
        window.location.reload();
      } catch (e) {
        error.value = e.message || '登录失败';
      } finally {
        loading.value = false;
      }
    };

    return { password, error, loading, submit };
  },
  template: `
    <div class="login-wrap">
      <div class="login-card">
        <h2>TradeLedger</h2>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">投资盈亏记录系统</p>
        <div class="form-group">
          <input type="password" class="form-control" v-model="password" placeholder="请输入访问密码" @keyup.enter="submit">
        </div>
        <div v-if="error" style="color: var(--danger); margin-bottom: 12px; font-size: 0.9rem;">{{ error }}</div>
        <button class="btn btn-primary btn-block" :disabled="loading" @click="submit">
          {{ loading ? '登录中...' : '进入系统' }}
        </button>
      </div>
    </div>
  `
};
