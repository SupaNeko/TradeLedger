const { createApp, ref, provide, inject, reactive, computed, onMounted, watch } = Vue;

const App = {
  setup() {
    provide('global', globalState);
    return { globalState, loadAccounts };
  },
  template: `
    <router-view @refresh-accounts="loadAccounts"></router-view>
  `
};

createApp(App).use(router).mount('#app');
