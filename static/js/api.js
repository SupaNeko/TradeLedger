const API_BASE = '';

async function api(path, opts = {}) {
  const url = API_BASE + path;
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts
  });
  if (res.status === 401) {
    window.location.hash = '#/login';
    throw new Error('Unauthorized');
  }
  if (res.status === 403) {
    const data = await res.json().catch(() => ({ detail: 'Forbidden' }));
    throw new Error(data.detail || 'Guest cannot perform this action');
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(data.detail || 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

const globalState = Vue.reactive({
  currentAccountId: null,
  accounts: [],
  role: null,
});

const $api = {
  login: async (password) => {
    const data = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
    globalState.role = data.role;
    return data;
  },
  logout: () => api('/api/auth/logout', { method: 'POST' }),
  me: async () => {
    const data = await api('/api/auth/me');
    globalState.role = data.role;
    return data;
  },

  getAccounts: () => api('/api/accounts'),
  createAccount: (data) => api('/api/accounts', { method: 'POST', body: JSON.stringify(data) }),
  updateAccount: (id, data) => api(`/api/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAccount: (id) => api(`/api/accounts/${id}`, { method: 'DELETE' }),

  getCategories: () => api('/api/categories'),
  createCategory: (data) => api('/api/categories', { method: 'POST', body: JSON.stringify(data) }),
  deleteCategory: (id) => api(`/api/categories/${id}`, { method: 'DELETE' }),

  getProducts: (categoryId) => api('/api/products' + (categoryId ? `?category_id=${categoryId}` : '')),
  createProduct: (data) => api('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id, data) => api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id) => api(`/api/products/${id}`, { method: 'DELETE' }),

  getTrades: (params) => {
    const qs = new URLSearchParams();
    for (const k in params) if (params[k] != null && params[k] !== '') qs.append(k, params[k]);
    return api('/api/trades?' + qs.toString());
  },
  buy: (data) => api('/api/trades/buy', { method: 'POST', body: JSON.stringify(data) }),
  sell: (data) => api('/api/trades/sell', { method: 'POST', body: JSON.stringify(data) }),
  deleteTrade: (id) => api(`/api/trades/${id}`, { method: 'DELETE' }),
  updateTrade: (id, data) => api(`/api/trades/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  getSummary: (accountId) => api(`/api/dashboard/summary?account_id=${accountId}`),
  getHoldings: (accountId) => api(`/api/dashboard/holdings?account_id=${accountId}`),
  getProfits: (accountId) => api(`/api/dashboard/profits?account_id=${accountId}`),
  getProfitRatios: (accountId) => api(`/api/dashboard/profit-ratios?account_id=${accountId}`),
  getProfitByCategory: (accountId) => api(`/api/dashboard/profit-by-category?account_id=${accountId}`),
};

const loadAccounts = async () => {
  try {
    const list = await $api.getAccounts();
    globalState.accounts = list;
    if (list.length && !globalState.currentAccountId) {
      globalState.currentAccountId = list[0].id;
    }
  } catch (e) {
    console.error('loadAccounts error', e);
  }
};
