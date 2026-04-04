import { Fragment, useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { api } from '../lib/api';
import { formatCurrency, formatDate, subscriptionLabel } from '../lib/format';
import { useI18n } from '../i18n';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1', '#ec4899', '#14b8a6'];

export default function Brands() {
  const { t } = useI18n();
  const [brands, setBrands] = useState<any>({ brands: [], total: 0 });
  const [subStats, setSubStats] = useState<any[]>([]);
  const [expiringPlans, setExpiringPlans] = useState<any[]>([]);
  const [leastActive, setLeastActive] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [subFilter, setSubFilter] = useState('');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [showAllInactive, setShowAllInactive] = useState(false);

  const toggleUser = (userId: string) => {
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  // Group brands by owner userId, preserving order of first appearance
  const groupedBrands = (() => {
    const groups: { userId: string; owner: any; brands: any[] }[] = [];
    const seen = new Map<string, number>();
    for (const b of brands.brands || []) {
      const uid = b.userId;
      if (seen.has(uid)) {
        groups[seen.get(uid)!].brands.push(b);
      } else {
        seen.set(uid, groups.length);
        groups.push({ userId: uid, owner: b, brands: [b] });
      }
    }
    return groups;
  })();

  const fetchBrands = async (p: number, s: string, sub?: string) => {
    const filter = sub !== undefined ? sub : subFilter;
    const result = await api.brands.list(p, 50, s, filter);
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
        if (data.expiringPlans) setExpiringPlans(data.expiringPlans);
        if (data.leastActive) setLeastActive(data.leastActive);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSearch = () => fetchBrands(1, search);
  const handleFilter = (f: string) => {
    setSubFilter(f);
    setPage(1);
    fetchBrands(1, search, f);
  };
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

      {/* Expiring Subscriptions */}
      {expiringPlans.length > 0 && (() => {
        const enriched = expiringPlans.map((p: any) => {
          const diffMs = new Date(p.expiryDate).getTime() - Date.now();
          const days = Math.ceil(diffMs / 86400000);
          return { ...p, days };
        });
        const overdue = enriched.filter(p => p.days < 0);
        const within30 = enriched.filter(p => p.days >= 0 && p.days <= 30);
        const within60 = enriched.filter(p => p.days > 30 && p.days <= 60);
        const within90 = enriched.filter(p => p.days > 60 && p.days <= 90);

        const tiers = [
          { key: 'overdue', items: overdue, label: t('renewalOverdue'), color: 'red', borderColor: 'border-red-500/30' },
          { key: '30d', items: within30, label: t('renewalUrgent'), color: 'red', borderColor: 'border-red-500/20' },
          { key: '60d', items: within60, label: t('renewal60d'), color: 'amber', borderColor: 'border-amber-500/20' },
          { key: '90d', items: within90, label: t('renewal90d'), color: 'blue', borderColor: 'border-blue-500/20' },
        ].filter(tier => tier.items.length > 0);

        const RenewalRow = ({ p }: { p: any }) => {
          const absDays = Math.abs(p.days);
          const isOverdue = p.days < 0;
          const urgent = p.days >= 0 && p.days <= 7;
          return (
            <tr className={`border-b border-white/5 hover:bg-white/[0.02] ${isOverdue ? 'bg-red-500/[0.03]' : ''}`}>
              <td className="py-2.5 px-4 text-slate-200">{p.fullName || p.email || p.phoneNumber || '—'}</td>
              <td className="py-2.5 px-4 text-slate-400">{p.brandName}</td>
              <td className="py-2.5 px-4 text-slate-300">{subscriptionLabel(p.subscriptionLevel, t)}</td>
              <td className={`py-2.5 px-4 ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>{formatDate(p.expiryDate)}</td>
              <td className="py-2.5 px-4">
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  isOverdue ? 'bg-red-500/20 text-red-400' : urgent ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/15 text-amber-400'
                }`}>
                  {isOverdue ? t('daysOverdue', { days: absDays }) : p.days === 0 ? t('expiresToday') : t('daysLeft', { days: p.days })}
                </span>
              </td>
              <td className="py-2.5 px-4 text-right text-emerald-400">{p.balance ? formatCurrency(parseFloat(p.balance)) : '—'}</td>
              <td className="py-2.5 px-4 text-xs text-slate-500">{p.email || p.phoneNumber || '—'}</td>
            </tr>
          );
        };

        return (
          <div className="bg-navy-900 border border-amber-500/20 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h3 className="text-lg font-semibold text-amber-300">{t('expiringSubscriptions')}</h3>
              <span className="text-xs text-slate-500">{t('expiringSubtitle')}</span>
            </div>
            <div className="flex items-center gap-3 mb-4 text-xs">
              {overdue.length > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">{t('renewalOverdue')}: {overdue.length}</span>}
              {within30.length > 0 && <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-300">{t('renewalUrgent')}: {within30.length}</span>}
              {within60.length > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{t('renewal60d')}: {within60.length}</span>}
              {within90.length > 0 && <span className="px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">{t('renewal90d')}: {within90.length}</span>}
            </div>
            {tiers.map((tier) => (
              <div key={tier.key} className="mb-4 last:mb-0">
                <div className={`text-xs font-medium text-${tier.color}-400 mb-2 pl-1`}>{tier.label} ({tier.items.length})</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-slate-400 border-b border-white/5">
                        <th className="text-left py-2 px-4 font-medium">{t('owner')}</th>
                        <th className="text-left py-2 px-4 font-medium">{t('brand')}</th>
                        <th className="text-left py-2 px-4 font-medium">{t('plan')}</th>
                        <th className="text-left py-2 px-4 font-medium">{t('expiresOn')}</th>
                        <th className="text-left py-2 px-4 font-medium"></th>
                        <th className="text-right py-2 px-4 font-medium">{t('balance')}</th>
                        <th className="text-left py-2 px-4 font-medium">{t('contact')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tier.items.map((p: any, i: number) => (
                        <RenewalRow key={`${p.userId}-${i}`} p={p} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Least Active Brands */}
      {leastActive.length > 0 && (
        <div className="bg-navy-900 border border-white/5 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-lg font-semibold">{t('leastActiveBrands')}</h3>
            <span className="text-xs text-slate-500">{t('leastActiveSubtitle')}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-white/5">
                  <th className="text-left py-2 px-4 font-medium">{t('brand')}</th>
                  <th className="text-left py-2 px-4 font-medium">{t('plan')}</th>
                  <th className="text-left py-2 px-4 font-medium">{t('lastActive')}</th>
                  <th className="text-left py-2 px-4 font-medium"></th>
                  <th className="text-right py-2 px-4 font-medium">{t('balance')}</th>
                  <th className="text-left py-2 px-4 font-medium">{t('contact')}</th>
                </tr>
              </thead>
              <tbody>
                {(showAllInactive ? leastActive : leastActive.slice(0, 10)).map((b: any, i: number) => {
                  const diffMs = Date.now() - new Date(b.lastActive).getTime();
                  const daysAgo = Math.floor(diffMs / 86400000);
                  return (
                    <tr key={`${b.userId}-${i}`} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-4">
                        <div className="text-slate-200 font-medium">{b.brandName}</div>
                        <div className="text-xs text-slate-500">{b.fullName || b.email || b.phoneNumber || '—'}</div>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="text-slate-300">{subscriptionLabel(b.subscriptionLevel, t)}</span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-400">{formatDate(b.lastActive)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          daysAgo > 90 ? 'bg-red-500/15 text-red-400' : daysAgo > 30 ? 'bg-amber-500/15 text-amber-400' : 'bg-slate-500/15 text-slate-400'
                        }`}>
                          {t('daysAgo', { days: daysAgo })}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-400">
                        {b.balance ? formatCurrency(parseFloat(b.balance)) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-slate-500">{b.email || b.phoneNumber || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {leastActive.length > 10 && (
            <button
              onClick={() => setShowAllInactive(!showAllInactive)}
              className="mt-3 w-full py-2 text-sm text-slate-400 hover:text-slate-200 bg-white/[0.03] hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              {showAllInactive ? t('showLess') : `${t('showMore')} (${leastActive.length})`}
            </button>
          )}
        </div>
      )}

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

        <div className="flex gap-2 mb-4">
          {[
            { key: '', label: t('filterAll') },
            { key: 'subscribed', label: t('filterSubscribed') },
            { key: 'free', label: t('filterFree') },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilter(f.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                subFilter === f.key
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-slate-400 border-b border-white/5">
                <th className="text-left py-3 px-4 font-medium w-8"></th>
                <th className="text-left py-3 px-4 font-medium">{t('owner')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('brands')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('plan')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('planExpiry')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('lastDeposit')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('totalDeposited')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('balance')}</th>
              </tr>
            </thead>
            <tbody>
              {groupedBrands.map((group) => {
                const isExpanded = expandedUsers.has(group.userId);
                const b = group.owner;
                return (
                  <Fragment key={group.userId}>
                    {/* User row */}
                    <tr
                      className={`border-b border-white/5 hover:bg-white/[0.02] transition-colors ${group.brands.length > 1 ? 'cursor-pointer' : ''}`}
                      onClick={() => group.brands.length > 1 && toggleUser(group.userId)}
                    >
                      <td className="py-3 px-4 w-8">
                        {group.brands.length > 1 && (
                          <span className="text-slate-500 text-xs">
                            {isExpanded ? '▾' : '▸'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium">{b.fullName || b.email || b.phoneNumber || '—'}</div>
                        {b.fullName && (b.email || b.phoneNumber) && <div className="text-xs text-slate-500">{b.email || b.phoneNumber}</div>}
                      </td>
                      <td className="py-3 px-4">
                        {group.brands.length === 1 ? (
                          <span className="text-slate-300">{group.brands[0].brandName}</span>
                        ) : (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                            {t('brandsCount', { count: group.brands.length })}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="text-slate-300">{subscriptionLabel(b.subscriptionLevel, t)}</span>
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
                    {/* Expanded brand rows */}
                    {isExpanded && group.brands.map((brand: any) => (
                      <tr
                        key={brand.brandId}
                        className="border-b border-white/5 bg-white/[0.015]"
                      >
                        <td className="py-2 px-4"></td>
                        <td className="py-2 px-4" colSpan={2}>
                          <div className="flex items-center gap-2 pl-4">
                            <span className="text-slate-500 text-xs">└</span>
                            <span className="text-slate-400 text-[13px]">{brand.brandName}</span>
                            <span className="text-slate-600 text-xs">
                              {brand.brandCreatedAt ? formatDate(brand.brandCreatedAt) : ''}
                            </span>
                          </div>
                        </td>
                        <td colSpan={5}></td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
              {brands.brands.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">{t('noBrandsFound')}</td>
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
