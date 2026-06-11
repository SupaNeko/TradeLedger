const { createRouter, createWebHashHistory } = VueRouter;

const routes = [
  { path: '/login', component: LoginPage },
  { path: '/', component: DashboardPage },
  { path: '/trades', component: TradeListPage },
  { path: '/trades/buy', component: TradeBuyPage },
  { path: '/trades/sell', component: TradeSellPage },
  { path: '/accounts', component: AccountsPage },
  { path: '/settings', component: SettingsPage },
];

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  if (to.path === '/login') return next();
  try {
    await $api.me();
    await loadAccounts();
    next();
  } catch (e) {
    next('/login');
  }
});
