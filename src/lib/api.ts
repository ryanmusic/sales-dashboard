const BASE = '/api';

async function fetchJSON<T>(url: string): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postJSON<T>(url: string, body: any): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

async function patchJSON<T>(url: string, body: any): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${url}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
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
    list: (page = 1, limit = 50, search = '', subscription = '') =>
      fetchJSON<any>(`/brands?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&subscription=${encodeURIComponent(subscription)}`),
    subscriptionStats: () => fetchJSON<any[]>('/brands/subscription-stats'),
  },
  campaigns: {
    all: () => fetchJSON<any>('/campaigns/all'),
    list: (page = 1, limit = 50, search = '', status = '') =>
      fetchJSON<any>(`/campaigns?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&status=${encodeURIComponent(status)}`),
    reservations: (campaignId: string) => fetchJSON<any[]>(`/campaigns/${campaignId}/reservations`),
    updateCampaign: (campaignId: string, endTimestamp: string) =>
      patchJSON<any>(`/campaigns/${campaignId}`, { endTimestamp }),
    updateReservation: (campaignId: string, reservationId: string, data: { expireTimestamp?: string; status?: string }) =>
      patchJSON<any>(`/campaigns/${campaignId}/reservations/${reservationId}`, data),
  },
  accounts: {
    create: (data: any) => postJSON<any>('/users/create', data),
  },
  creators: {
    all: () => fetchJSON<any>('/creators/all'),
    payouts: (page = 1, limit = 50, status = '') =>
      fetchJSON<any>(`/creators/payouts?page=${page}&limit=${limit}&status=${encodeURIComponent(status)}`),
    stats: () => fetchJSON<any[]>('/creators/stats'),
    balances: () => fetchJSON<any[]>('/creators/balances'),
  },
};
