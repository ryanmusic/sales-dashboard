import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/format';
import { useI18n } from '../i18n';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

const TIER_COLORS: Record<string, string> = {
  strategic: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  growth: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  transactional: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  free: 'bg-slate-500/10 text-slate-500 border-slate-500/20',
};

const TIER_ORDER = ['strategic', 'growth', 'transactional', 'free'];

export default function VipDashboard() {
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState('');
  const [riskOnly, setRiskOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<string>('vipScore');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    api.vip.scoring()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const toggleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(col);
      setSortDir('desc');
    }
  };

  const filtered = data.customers
    .filter((c: any) => {
      if (tierFilter && c.tier !== tierFilter) return false;
      if (riskOnly && !c.atRisk) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          (c.fullName || '').toLowerCase().includes(s) ||
          (c.email || '').toLowerCase().includes(s) ||
          (c.brandName || '').toLowerCase().includes(s) ||
          (c.phoneNumber || '').includes(s)
        );
      }
      return true;
    })
    .sort((a: any, b: any) => {
      const av = a[sortBy] ?? 0;
      const bv = b[sortBy] ?? 0;
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const SortHeader = ({ col, label }: { col: string; label: string }) => (
    <th
      className="text-left py-3 px-3 font-medium cursor-pointer hover:text-slate-200 transition-colors select-none"
      onClick={() => toggleSort(col)}
    >
      {label} {sortBy === col ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  );

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('vipDashboard')}</h2>

      {/* Tier Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard
          title="Strategic VIP"
          value={String(data.tierCounts.strategic)}
          subtitle={t('vipHighValue')}
          color="amber"
        />
        <StatCard
          title="Growth VIP"
          value={String(data.tierCounts.growth)}
          subtitle={t('vipGrowing')}
          color="blue"
        />
        <StatCard
          title="Transactional"
          value={String(data.tierCounts.transactional)}
          subtitle={t('vipTransactional')}
          color="violet"
        />
        <StatCard
          title="Free"
          value={String(data.tierCounts.free)}
          subtitle={t('vipFreeUsers')}
          color="emerald"
        />
        <StatCard
          title={t('vipAtRisk')}
          value={String(data.atRiskCount)}
          subtitle={t('vipNeedsAttention')}
          color="amber"
        />
      </div>

      {/* Filters */}
      <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchBrands')}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 w-64 focus:outline-none focus:border-blue-500"
          />
          <div className="flex items-center gap-1">
            {['', ...TIER_ORDER].map((tier) => (
              <button
                key={tier}
                onClick={() => setTierFilter(tier)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  tierFilter === tier
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {tier ? t(`vipTier_${tier}`) : t('filterAll')}
              </button>
            ))}
          </div>
          <button
            onClick={() => setRiskOnly(!riskOnly)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              riskOnly
                ? 'bg-red-500/20 text-red-400'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            {t('vipAtRiskOnly')}
          </button>
          <span className="text-xs text-slate-500 ml-auto">{filtered.length} {t('total')}</span>
        </div>

        {/* Customer Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 text-xs border-b border-white/5">
                <SortHeader col="brandName" label={t('brand')} />
                <SortHeader col="fullName" label={t('owner')} />
                <th className="text-left py-3 px-3 font-medium">{t('contact')}</th>
                <SortHeader col="vipScore" label={t('vipScoreLabel')} />
                <th className="text-left py-3 px-3 font-medium">{t('vipTierLabel')}</th>
                <SortHeader col="spend3m" label={t('vipSpend3m')} />
                <SortHeader col="spendYear" label={t('vipSpendYear')} />
                <SortHeader col="activeMonths" label={t('vipActivity')} />
                <SortHeader col="taskCount" label={t('vipTasks')} />
                <th className="text-left py-3 px-3 font-medium">{t('vipGrowth')}</th>
                <SortHeader col="inactiveDays" label={t('vipInactive')} />
                <th className="text-left py-3 px-3 font-medium">{t('balance')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c: any) => (
                <tr key={c.userId} className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${c.atRisk ? 'bg-red-500/[0.03]' : ''}`}>
                  <td className="py-2.5 px-3 text-slate-200 whitespace-nowrap">{c.brandName || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">{c.fullName || '—'}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-xs whitespace-nowrap">
                    {c.email || c.phoneNumber || '—'}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className="font-mono font-medium text-slate-200">{c.vipScore}</span>
                    <span className="text-[10px] text-slate-500 ml-1">
                      ({c.scoreSpend}/{c.scoreActive}/{c.scoreTasks}/{c.scoreGrowth})
                    </span>
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${TIER_COLORS[c.tier]}`}>
                      {t(`vipTier_${c.tier}`)}
                    </span>
                    {c.atRisk && (
                      <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/30">
                        {t('vipRisk')}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap text-right font-mono text-xs">
                    {c.spend3m > 0 ? formatCurrency(c.spend3m) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap text-right font-mono text-xs">
                    {c.spendYear > 0 ? formatCurrency(c.spendYear) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-400 text-xs">{c.activeMonths}/3</td>
                  <td className="py-2.5 px-3 text-center text-slate-400 text-xs">{c.taskCount}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                    {(() => {
                      const thisQ = parseFloat(c.thisQuarterRev) || 0;
                      const lastQ = parseFloat(c.lastQuarterRev) || 0;
                      if (lastQ === 0 && thisQ === 0) return <span className="text-slate-500">—</span>;
                      if (lastQ === 0) return <span className="text-emerald-400">NEW</span>;
                      const rate = ((thisQ - lastQ) / lastQ * 100).toFixed(0);
                      const num = parseFloat(rate);
                      return (
                        <span className={num > 0 ? 'text-emerald-400' : num < 0 ? 'text-red-400' : 'text-slate-400'}>
                          {num > 0 ? '+' : ''}{rate}%
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-2.5 px-3 whitespace-nowrap text-xs">
                    {c.inactiveDays != null ? (
                      <span className={c.atRisk ? 'text-red-400 font-medium' : 'text-slate-400'}>
                        {c.inactiveDays}d
                      </span>
                    ) : '—'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-xs text-right font-mono whitespace-nowrap">
                    {c.balance ? formatCurrency(parseFloat(c.balance)) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
