import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import { formatCurrency, formatDate, subscriptionLabel, statusClass } from '../lib/format';
import { useI18n } from '../i18n';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];

export default function Brands() {
  const { t } = useI18n();
  const [brands, setBrands] = useState<any>({ brands: [], total: 0 });
  const [subStats, setSubStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const fetchBrands = async (p: number, s: string) => {
    const result = await api.brands.list(p, 50, s);
    setBrands(result);
    setPage(p);
  };

  useEffect(() => {
    api.brands.all()
      .then((data) => {
        setBrands({ brands: data.brands, total: data.total, page: data.page, limit: data.limit });
        setSubStats(
          data.subStats.map((r: any) => ({
            name: subscriptionLabel(r.subscriptionLevel, t),
            value: parseInt(r.count),
          })),
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = () => fetchBrands(1, search);
  const totalPages = Math.ceil(brands.total / 50);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('brands')}</h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard title={t('totalBrands')} value={String(brands.total)} color="blue" />
        <StatCard
          title={t('payingBrands')}
          value={String(subStats.filter((s) => s.name !== t('subFree')).reduce((sum, s) => sum + s.value, 0))}
          color="emerald"
        />
        <StatCard
          title={t('freeTier')}
          value={String(subStats.find((s) => s.name === t('subFree'))?.value || 0)}
          color="violet"
        />
        <StatCard
          title={t('conversionRate')}
          value={`${subStats.length > 0 ? ((subStats.filter((s) => s.name !== t('subFree')).reduce((sum, s) => sum + s.value, 0) / subStats.reduce((sum, s) => sum + s.value, 0)) * 100).toFixed(1) : 0}%`}
          color="amber"
        />
      </div>

      <div className="bg-navy-900 border border-white/5 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4">{t('subscriptionDistribution')}</h3>
        <div className="flex items-center gap-8">
          <div className="h-48 w-48 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={subStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {subStats.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1a1f37', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                  itemStyle={{ color: '#e2e8f0' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {subStats.map((s, i) => (
              <div key={s.name} className="flex items-center gap-2 text-sm">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-slate-300">{s.name}</span>
                <span className="text-slate-500">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Brand Table */}
      <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('brandList')}</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t('searchBrands')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500/50 text-slate-200 placeholder-slate-500 w-64"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors"
            >
              {t('search')}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-white/5">
                <th className="text-left py-3 px-4 font-medium">{t('brand')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('owner')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('plan')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('status')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('startDate')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('planExpiry')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('lastDeposit')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('totalDeposited')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('balance')}</th>
              </tr>
            </thead>
            <tbody>
              {brands.brands.map((b: any) => {
                const isActive = !b.unsubscribedAt && b.subscriptionLevel !== 'FREE';
                return (
                  <tr key={b.brandId} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-slate-200 font-medium">{b.brandName}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-300">{b.fullName || '—'}</div>
                      <div className="text-xs text-slate-500">{b.email}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="text-slate-300">{subscriptionLabel(b.subscriptionLevel, t)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${isActive ? 'badge-success' : b.subscriptionLevel === 'FREE' ? 'badge-neutral' : 'badge-error'}`}>
                        {isActive ? t('active') : b.subscriptionLevel === 'FREE' ? t('free') : t('cancelled')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {b.brandCreatedAt ? formatDate(b.brandCreatedAt) : '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {b.planExpiry ? formatDate(b.planExpiry) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-300">
                      {b.lastDepositAmount ? formatCurrency(parseFloat(b.lastDepositAmount)) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-200">
                      {b.totalDeposited ? formatCurrency(parseFloat(b.totalDeposited)) : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-400">
                      {b.balance ? formatCurrency(parseFloat(b.balance)) : '—'}
                    </td>
                  </tr>
                );
              })}
              {brands.brands.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">{t('noBrandsFound')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/5">
            <button
              onClick={() => fetchBrands(page - 1, search)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t('prev')}
            </button>
            <span className="text-sm text-slate-400">
              {t('pageOf', { page, total: totalPages })}
            </span>
            <button
              onClick={() => fetchBrands(page + 1, search)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t('next')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
