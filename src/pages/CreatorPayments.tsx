import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, statusClass, statusLabel } from '../lib/format';
import { useI18n } from '../i18n';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

const STATUSES = ['', 'pending', 'approved', 'processing', 'wired_successful', 'rejected', 'cancelled', 'wire_failed'];

export default function CreatorPayments() {
  const { t } = useI18n();
  const [payouts, setPayouts] = useState<any>({ payouts: [], total: 0 });
  const [stats, setStats] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [igSearch, setIgSearch] = useState('');
  const [igResults, setIgResults] = useState<any[] | null>(null);
  const [searchingIg, setSearchingIg] = useState(false);

  useEffect(() => {
    api.creators.all()
      .then((data) => {
        setPayouts(data.payouts);
        setStats(data.stats);
        setBalances(data.balances);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const fetchPayouts = async (p: number, status: string) => {
    const result = await api.creators.payouts(p, 50, status);
    setPayouts(result);
    setPage(p);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setIgResults(null);
    fetchPayouts(1, status);
  };

  const handleIgSearch = async () => {
    if (!igSearch.trim()) { setIgResults(null); return; }
    setSearchingIg(true);
    try {
      const results = await api.creators.searchByIg(igSearch.trim());
      setIgResults(results);
    } catch (err) {
      console.error(err);
    } finally {
      setSearchingIg(false);
    }
  };

  const handlePayoutAction = async (payoutId: string, newStatus: string) => {
    const msgs: Record<string, string> = { approved: t('confirmApprove'), rejected: t('confirmReject'), wired_successful: t('confirmWired') };
    if (!confirm(msgs[newStatus] || t('confirmChange'))) return;
    try {
      await api.creators.updatePayout(payoutId, newStatus);
      // Refresh data
      if (igResults) {
        handleIgSearch();
      } else {
        fetchPayouts(page, statusFilter);
      }
      // Refresh stats
      const data = await api.creators.all();
      setStats(data.stats);
    } catch (err: any) {
      alert(err.message || 'Failed to update payout');
    }
  };

  if (loading) return <LoadingSpinner />;

  const totalPaid = stats
    .filter((s) => s.status === 'wired_successful')
    .reduce((sum, s) => sum + s.totalNet, 0);
  const totalPending = stats
    .filter((s) => ['pending', 'approved', 'processing'].includes(s.status))
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const totalCommission = stats.reduce((sum, s) => sum + s.totalCommission, 0);

  const totalPages = Math.ceil(payouts.total / 50);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('navCreatorPayments')}</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title={t('totalPaidOut')} value={formatCurrency(totalPaid)} color="emerald" />
        <StatCard title={t('pendingPayouts')} value={formatCurrency(totalPending)} color="amber" />
        <StatCard title={t('totalCommission')} value={formatCurrency(totalCommission)} color="violet" />
        <StatCard
          title={t('outstandingBalances')}
          value={String(balances.length)}
          subtitle={t('creatorsWithBalance')}
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Payout Status Breakdown */}
        <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">{t('byStatus')}</h3>
          <div className="space-y-3">
            {stats.map((s) => (
              <div key={s.status} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`badge ${statusClass(s.status)}`}>{statusLabel(s.status, t)}</span>
                  <span className="text-sm text-slate-400">({s.count})</span>
                </div>
                <span className="text-sm font-medium text-slate-200">{formatCurrency(s.totalAmount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Balances */}
        <div className="lg:col-span-2 bg-navy-900 border border-white/5 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">{t('topCreatorBalances')}</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-white/5">
                  <th className="text-left py-2 px-3 font-medium">{t('creator')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('instagram')}</th>
                  <th className="text-left py-2 px-3 font-medium">{t('currency')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('income')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('expense')}</th>
                  <th className="text-right py-2 px-3 font-medium">{t('balance')}</th>
                </tr>
              </thead>
              <tbody>
                {balances.slice(0, 10).map((b, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-2 px-3 text-slate-300">{b.fullName || b.userid?.slice(0, 8)}</td>
                    <td className="py-2 px-3 text-slate-400">
                      {b.igUsername ? (
                        <a href={`https://instagram.com/${b.igUsername}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">@{b.igUsername}</a>
                      ) : '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{b.currency}</td>
                    <td className="py-2 px-3 text-right text-slate-300">{formatCurrency(parseFloat(b.totalincome), b.currency)}</td>
                    <td className="py-2 px-3 text-right text-slate-400">{formatCurrency(parseFloat(b.totalexpense), b.currency)}</td>
                    <td className="py-2 px-3 text-right font-medium text-emerald-400">{formatCurrency(parseFloat(b.balance), b.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payout Records */}
      <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="text-lg font-semibold">{t('payoutRecords')}</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={igSearch}
                onChange={(e) => setIgSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleIgSearch()}
                placeholder={t('searchByIg')}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-200 w-44 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleIgSearch}
                disabled={searchingIg}
                className="px-3 py-1.5 text-sm bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
              >
                {t('search')}
              </button>
              {igResults && (
                <button
                  onClick={() => { setIgResults(null); setIgSearch(''); }}
                  className="px-2 py-1.5 text-sm text-slate-400 hover:text-slate-200"
                >
                  ✕
                </button>
              )}
            </div>
            <span className="text-sm text-slate-400">{igResults ? igResults.length : payouts.total} {t('total')}</span>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:border-blue-500/50 text-slate-200"
            >
              <option value="">{t('allStatuses')}</option>
              {STATUSES.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s, t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-white/5">
                <th className="text-left py-3 px-4 font-medium">{t('date')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('creator')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('role')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('amount')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('commission')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('net')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('status')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('bank')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('notes')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {(igResults || payouts.payouts).map((p: any) => {
                const amount = parseFloat(p.amount);
                const autoApprovable = p.status === 'pending' && amount < 20000;
                return (
                <tr key={p.id} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${autoApprovable ? 'bg-emerald-500/[0.03]' : ''}`}>
                  <td className="py-3 px-4 text-slate-300">{formatDate(p.createTimestamp)}</td>
                  <td className="py-3 px-4">
                    <div className="text-slate-200">{p.fullName || '—'}</div>
                    <div className="text-xs text-slate-500">{p.email}</div>
                    {p.igUsername && <div className="text-xs"><a href={`https://instagram.com/${p.igUsername}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">@{p.igUsername}</a></div>}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${p.roleType === 'player' ? 'badge-info' : 'badge-warning'}`}>
                      {p.roleType}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium">
                    {formatCurrency(amount, p.currency)}
                    {autoApprovable && <div className="text-[10px] text-emerald-400">&lt;20K</div>}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-400">
                    {formatCurrency(parseFloat(p.commission), p.currency)}
                    <span className="text-xs ml-1">({(parseFloat(p.commissionRate) * 100).toFixed(0)}%)</span>
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-emerald-400">
                    {formatCurrency(parseFloat(p.net), p.currency)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`badge ${statusClass(p.status)}`}>{statusLabel(p.status, t)}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400 text-xs">
                    {p.bankCode ? `${p.bankCode} ****${p.bankAccountNumber?.slice(-4)}` : '—'}
                  </td>
                  <td className="py-3 px-4 text-slate-500 text-xs max-w-[150px] truncate">
                    {p.comment || p.reason || '—'}
                  </td>
                  <td className="py-3 px-4 whitespace-nowrap">
                    {p.status === 'pending' && (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handlePayoutAction(p.id, 'approved')} className="px-2 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30">{t('approve')}</button>
                        <button onClick={() => handlePayoutAction(p.id, 'rejected')} className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30">{t('reject')}</button>
                      </div>
                    )}
                    {p.status === 'approved' && (
                      <button onClick={() => handlePayoutAction(p.id, 'wired_successful')} className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30">{t('markWired')}</button>
                    )}
                  </td>
                </tr>
                );
              })}
              {payouts.payouts.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">{t('noPayoutsFound')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/5">
            <button
              onClick={() => fetchPayouts(page - 1, statusFilter)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t('prev')}
            </button>
            <span className="text-sm text-slate-400">
              {t('pageOf', { page, total: totalPages })}
            </span>
            <button
              onClick={() => fetchPayouts(page + 1, statusFilter)}
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
