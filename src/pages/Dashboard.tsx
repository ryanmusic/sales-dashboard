import { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import { formatCurrency, formatDateTime } from '../lib/format';
import { useI18n } from '../i18n';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Dashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [recentTxns, setRecentTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.dashboard.all()
      .then((data) => {
        setStats(data.stats);
        setChartData(
          data.chartData.map((d: any) => ({
            ...d,
            month: new Date(d.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          })),
        );
        setRecentTxns(data.recentTransactions);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('navOverview')}</h2>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        <StatCard
          title={t('totalRevenue')}
          value={formatCurrency(stats?.totalRevenue || 0)}
          subtitle={t('allTime')}
          color="blue"
        />
        <StatCard
          title={t('profit')}
          value={formatCurrency(stats?.profit || 0)}
          subtitle={t('profitSubtitle')}
          color="emerald"
        />
        <StatCard
          title={t('revenueLast30d')}
          value={formatCurrency(stats?.revenueLast30d || 0)}
          subtitle={t('last30Days')}
          color="violet"
        />
        <StatCard
          title={t('creatorPayouts')}
          value={formatCurrency(stats?.totalCreatorPayouts || 0)}
          subtitle={t('totalPaid')}
          color="amber"
        />
        <StatCard
          title={t('activeSubscriptions')}
          value={String(stats?.activeSubscriptions || 0)}
          subtitle={t('activeBrands', { count: stats?.activeBrands || 0 })}
          color="blue"
        />
      </div>

      {/* Revenue Chart */}
      <div className="bg-navy-900 border border-white/5 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">{t('monthlyRevenue')}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip
                contentStyle={{ background: '#1a1f37', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                formatter={(value: number) => [formatCurrency(value), t('revenue')]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} fill="url(#revenueGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
        <h3 className="text-lg font-semibold mb-4">{t('recentTransactions')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-white/5">
                <th className="text-left py-3 px-4 font-medium">{t('date')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('type')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('from')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('to')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('amount')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('currency')}</th>
              </tr>
            </thead>
            <tbody>
              {recentTxns.map((txn) => (
                <tr key={txn.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-slate-300">{formatDateTime(txn.createTimestamp)}</td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-xs font-medium">
                      {txn.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{txn.fromName || '—'}</td>
                  <td className="py-3 px-4 text-slate-300">{txn.toName || '—'}</td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(parseFloat(txn.amount), txn.currency)}</td>
                  <td className="py-3 px-4 text-slate-400">{txn.currency}</td>
                </tr>
              ))}
              {recentTxns.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">{t('noTransactionsFound')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
