const BASE = '/api';

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export const api = {
  dashboard: {
    all: (months = 12) => fetchJSON<any>(`/dashboard/all?months=${months}`),
    stats: () => fetchJSON<any>('/dashboard/stats'),
    revenueChart: (months = 12) => fetchJSON<any[]>(`/dashboard/revenue-chart?months=${months}`),
    recentTransactions: () => fetchJSON<any[]>('/dashboard/recent-transactions'),
  },
  revenue: {
    all: () => fetchJSON<any>('/revenue/all'),
    breakdown: () => fetchJSON<any[]>('/revenue/breakdown'),
    deposits: (page = 1, limit = 50) => fetchJSON<any>(`/revenue/deposits?page=${page}&limit=${limit}`),
    mrr: () => fetchJSON<any[]>('/revenue/mrr'),
  },
  brands: {
    all: () => fetchJSON<any>('/brands/all'),
    list: (page = 1, limit = 50, search = '') =>
      fetchJSON<any>(`/brands?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),
    subscriptionStats: () => fetchJSON<any[]>('/brands/subscription-stats'),
  },
  creators: {
    all: () => fetchJSON<any>('/creators/all'),
    payouts: (page = 1, limit = 50, status = '') =>
      fetchJSON<any>(`/creators/payouts?page=${page}&limit=${limit}&status=${encodeURIComponent(status)}`),
    stats: () => fetchJSON<any[]>('/creators/stats'),
    balances: () => fetchJSON<any[]>('/creators/balances'),
  },
};
