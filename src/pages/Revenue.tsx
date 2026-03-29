import { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { api } from '../lib/api';
import { formatCurrency, formatDate, subscriptionLabel, statusClass, statusLabel } from '../lib/format';
import { useI18n } from '../i18n';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Revenue() {
  const { t } = useI18n();
  const [mrr, setMrr] = useState<any[]>([]);
  const [deposits, setDeposits] = useState<any>({ records: [], total: 0 });
  const [breakdown, setBreakdown] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    api.revenue.all()
      .then((data) => {
        setMrr(
          data.mrr.map((r: any) => ({
            ...r,
            month: new Date(r.month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          })),
        );
        setDeposits(data.deposits);
        setBreakdown(data.breakdown);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadPage = async (p: number) => {
    setPage(p);
    const d = await api.revenue.deposits(p);
    setDeposits(d);
  };

  if (loading) return <LoadingSpinner />;

  const totalDeposits = breakdown
    .filter((b) => b.type === 'deposit')
    .reduce((sum, b) => sum + parseFloat(b.total), 0);
  const totalCommissions = breakdown
    .filter((b) => b.type === 'commission')
    .reduce((sum, b) => sum + parseFloat(b.total), 0);

  const totalPages = Math.ceil(deposits.total / 50);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('navRevenue')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard title={t('totalDeposits')} value={formatCurrency(totalDeposits)} color="blue" />
        <StatCard title={t('totalCommissions')} value={formatCurrency(totalCommissions)} color="emerald" />
        <StatCard
          title={t('transactionTypes')}
          value={String(breakdown.length)}
          subtitle={t('uniqueTypes')}
          color="violet"
        />
      </div>

      {/* MRR Chart */}
      <div className="bg-navy-900 border border-white/5 rounded-xl p-6 mb-8">
        <h3 className="text-lg font-semibold mb-4">{t('subscriptionVsOneTime')}</h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={mrr}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `$${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip
                contentStyle={{ background: '#1a1f37', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#e2e8f0' }}
                formatter={(value: number) => formatCurrency(value)}
              />
              <Legend wrapperStyle={{ color: '#94a3b8' }} />
              <Bar dataKey="subscriptionRevenue" name={t('subscription')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="onetimeRevenue" name={t('oneTime')} fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Deposit Records Table */}
      <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('depositRecords')}</h3>
          <span className="text-sm text-slate-400">{deposits.total} {t('total')}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-white/5">
                <th className="text-left py-3 px-4 font-medium">{t('date')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('brandUser')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('amount')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('plan')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('interval')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('status')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('unsubscribed')}</th>
              </tr>
            </thead>
            <tbody>
              {deposits.records.map((d: any) => (
                <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-slate-300">{formatDate(d.createTimestamp)}</td>
                  <td className="py-3 px-4">
                    <div className="text-slate-200">{d.userName || '—'}</div>
                    <div className="text-xs text-slate-500">{d.userEmail}</div>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">{formatCurrency(parseFloat(d.amount), d.currency)}</td>
                  <td className="py-3 px-4 text-slate-300">{subscriptionLabel(d.includedSubscriptionLevel, t)}</td>
                  <td className="py-3 px-4 text-slate-400">{d.every ? t('monthInterval', { count: d.every }) : t('oneTimeInterval')}</td>
                  <td className="py-3 px-4">
                    <span className={`badge ${statusClass(d.status)}`}>{statusLabel(d.status, t)}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">
                    {d.unsubscribedAt ? formatDate(d.unsubscribedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/5">
            <button
              onClick={() => loadPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t('prev')}
            </button>
            <span className="text-sm text-slate-400">
              {t('pageOf', { page, total: totalPages })}
            </span>
            <button
              onClick={() => loadPage(page + 1)}
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
