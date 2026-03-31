import { Fragment, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/format';
import { useI18n } from '../i18n';
import StatCard from '../components/StatCard';
import LoadingSpinner from '../components/LoadingSpinner';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400',
  pending: 'bg-amber-500/15 text-amber-400',
  expired: 'bg-slate-500/15 text-slate-400',
  concluded: 'bg-blue-500/15 text-blue-400',
  archived: 'bg-slate-500/15 text-slate-500',
};

const RESERVATION_COLORS: Record<string, string> = {
  booked: 'bg-emerald-500/15 text-emerald-400',
  boooked: 'bg-emerald-500/15 text-emerald-400',
  pending: 'bg-amber-500/15 text-amber-400',
  used: 'bg-blue-500/15 text-blue-400',
  expired: 'bg-slate-500/15 text-slate-400',
  canceled: 'bg-red-500/15 text-red-400',
  rejected: 'bg-red-500/15 text-red-400',
};

export default function Campaigns() {
  const { t } = useI18n();
  const [data, setData] = useState<any>({ campaigns: [], total: 0, stats: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Record<string, any[]>>({});
  const [loadingReservations, setLoadingReservations] = useState<string | null>(null);
  const [editingExpiry, setEditingExpiry] = useState<string | null>(null);
  const [newExpiry, setNewExpiry] = useState('');
  const [editingCampaignEnd, setEditingCampaignEnd] = useState<string | null>(null);
  const [newCampaignEnd, setNewCampaignEnd] = useState('');
  const [showRejected, setShowRejected] = useState<Set<string>>(new Set());

  const fetchCampaigns = async (p: number, s: string, status?: string) => {
    const filter = status !== undefined ? status : statusFilter;
    const result = await api.campaigns.list(p, 50, s, filter);
    setData(result);
    setPage(p);
  };

  useEffect(() => {
    api.campaigns.all()
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const toggleCampaign = async (id: string) => {
    if (expandedCampaign === id) {
      setExpandedCampaign(null);
      return;
    }
    setExpandedCampaign(id);
    if (!reservations[id]) {
      setLoadingReservations(id);
      try {
        const res = await api.campaigns.reservations(id);
        setReservations((prev) => ({ ...prev, [id]: res }));
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingReservations(null);
      }
    }
  };

  const handleUpdateExpiry = async (campaignId: string, reservationId: string) => {
    if (!newExpiry) return;
    try {
      await api.campaigns.updateReservation(campaignId, reservationId, new Date(newExpiry).toISOString());
      const res = await api.campaigns.reservations(campaignId);
      setReservations((prev) => ({ ...prev, [campaignId]: res }));
      setEditingExpiry(null);
      setNewExpiry('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCampaignEnd = async (campaignId: string) => {
    if (!newCampaignEnd) return;
    try {
      await api.campaigns.updateCampaign(campaignId, new Date(newCampaignEnd).toISOString());
      // Update local data
      setData((prev: any) => ({
        ...prev,
        campaigns: prev.campaigns.map((c: any) =>
          c.id === campaignId ? { ...c, endTimestamp: new Date(newCampaignEnd).toISOString() } : c,
        ),
        expiring: (prev.expiring || []).map((c: any) =>
          c.id === campaignId ? { ...c, endTimestamp: new Date(newCampaignEnd).toISOString() } : c,
        ),
      }));
      setEditingCampaignEnd(null);
      setNewCampaignEnd('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = () => fetchCampaigns(1, search);
  const handleFilter = (f: string) => {
    setStatusFilter(f);
    setPage(1);
    fetchCampaigns(1, search, f);
  };
  const totalPages = Math.ceil(data.total / 50);

  const campaignStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      active: t('campaignStatusActive'),
      pending: t('campaignStatusPending'),
      expired: t('campaignStatusExpired'),
      concluded: t('campaignStatusConcluded'),
      archived: t('campaignStatusArchived'),
    };
    return map[status] || status;
  };

  const reservationStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      booked: t('reservationBooked'),
      boooked: t('reservationBooked'),
      pending: t('reservationPending'),
      used: t('reservationUsed'),
      expired: t('reservationExpired'),
      canceled: t('reservationCanceled'),
      rejected: t('reservationRejected'),
    };
    return map[status] || status;
  };

  const paymentLabel = (type: string) => {
    if (type === 'cash') return t('paymentCash');
    if (type === 'product_exchange') return t('paymentProductExchange');
    return type;
  };

  const statByStatus = (status: string) => {
    const s = data.stats?.find((s: any) => s.status === status);
    return s ? parseInt(s.count) : 0;
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('campaigns')}</h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <StatCard title={t('totalCampaigns')} value={String(data.total || 0)} color="blue" />
        <StatCard title={t('campaignStatusActive')} value={String(statByStatus('active'))} color="emerald" />
        <StatCard title={t('campaignStatusPending')} value={String(statByStatus('pending'))} color="amber" />
        <StatCard title={t('campaignStatusExpired')} value={String(statByStatus('expired'))} color="violet" />
        <StatCard title={t('campaignStatusConcluded')} value={String(statByStatus('concluded'))} color="blue" />
      </div>

      {(data.expiring || []).length > 0 && (
        <div className="bg-navy-900 border border-amber-500/20 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />
            <h3 className="text-lg font-semibold">{t('expiringCampaigns')}</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">{t('expiringCampaignsSubtitle')}</p>
          <div className="space-y-2">
            {(data.expiring as any[]).map((c: any) => {
              const diffMs = new Date(c.endTimestamp).getTime() - Date.now();
              const days = Math.ceil(diffMs / 86400000);
              const overdue = days < 0;
              const absDays = Math.abs(days);
              const full = (c.currentSlots || 0) >= (c.slots || 0);
              const urgent = !full && (overdue || days <= 3);
              const isExpanded = expandedCampaign === c.id;
              const campaignReservations = reservations[c.id] || [];
              return (
                <div
                  key={c.id}
                  className={`rounded-lg ${
                    full
                      ? 'bg-emerald-500/5 border border-emerald-500/20'
                      : urgent
                        ? 'bg-red-500/5 border border-red-500/20'
                        : 'bg-white/[0.02] border border-white/5'
                  }`}
                >
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer"
                    onClick={() => toggleCampaign(c.id)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-slate-500 text-xs">{isExpanded ? '▾' : '▸'}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 font-medium text-sm truncate">{c.title}</span>
                          <span className="text-xs text-slate-500">{c.storeName}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {c.ownerName || c.ownerEmail || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-xs text-slate-500">{t('remainingSlots')}</div>
                        <div className={`text-sm font-medium ${full ? 'text-emerald-400' : urgent ? 'text-red-400' : 'text-slate-300'}`}>
                          {t('slotsUsed', { used: c.currentSlots || 0, total: c.slots })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-xs ${overdue ? 'text-red-400' : 'text-slate-500'}`}>
                          {formatDate(c.endTimestamp)}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          full
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : urgent
                              ? 'bg-red-500/15 text-red-400'
                              : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {overdue
                            ? t('ended', { days: absDays })
                            : days === 0
                              ? t('endsToday')
                              : t('endsIn', { days: absDays })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-white/5">
                      {loadingReservations === c.id ? (
                        <div className="text-sm text-slate-500 py-3 text-center">Loading...</div>
                      ) : campaignReservations.length === 0 ? (
                        <div className="text-sm text-slate-500 py-3 text-center">{t('noReservations')}</div>
                      ) : (() => {
                        const rejectedCount = campaignReservations.filter((r: any) => r.status === 'rejected').length;
                        const showingRejected = showRejected.has(c.id);
                        const filtered = [...campaignReservations]
                          .filter((r: any) => showingRejected || r.status !== 'rejected')
                          .sort((a, b) => (a.status === 'used' ? -1 : b.status === 'used' ? 1 : 0));
                        return (
                          <>
                            <table className="text-sm mt-1">
                              <thead>
                                <tr className="text-slate-500 text-xs">
                                  <th className="text-left py-1.5 pr-6 font-medium">{t('creatorName')}</th>
                                  <th className="text-left py-1.5 pr-6 font-medium">{t('instagram')}</th>
                                  <th className="text-left py-1.5 pr-6 font-medium">{t('reservationStatus')}</th>
                                  <th className="text-left py-1.5 pr-6 font-medium">{t('reservationExpiry')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.map((r: any) => (
                                  <tr key={r.id} className="border-t border-white/5">
                                    <td className="py-1.5 pr-6 text-slate-300 text-xs whitespace-nowrap">{r.creatorName || '—'}</td>
                                    <td className="py-1.5 pr-6 text-slate-400 text-xs whitespace-nowrap">{r.igUsername ? `@${r.igUsername}` : '—'}</td>
                                    <td className="py-1.5 pr-6 whitespace-nowrap">
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${RESERVATION_COLORS[r.status] || 'bg-slate-500/15 text-slate-400'}`}>
                                        {reservationStatusLabel(r.status)}
                                      </span>
                                    </td>
                                    <td className="py-1.5 pr-6 text-slate-400 text-xs whitespace-nowrap">{r.expireTimestamp ? formatDate(r.expireTimestamp) : '—'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {rejectedCount > 0 && (
                              <button
                                onClick={() => setShowRejected(prev => {
                                  const next = new Set(prev);
                                  if (next.has(c.id)) next.delete(c.id);
                                  else next.add(c.id);
                                  return next;
                                })}
                                className="mt-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
                              >
                                {showingRejected ? t('hideRejected') : t('showRejected', { count: rejectedCount })}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{t('campaignList')}</h3>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={t('searchCampaigns')}
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
            { key: 'active', label: t('campaignStatusActive') },
            { key: 'pending', label: t('campaignStatusPending') },
            { key: 'expired', label: t('campaignStatusExpired') },
            { key: 'concluded', label: t('campaignStatusConcluded') },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilter(f.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                statusFilter === f.key
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
                <th className="text-left py-3 px-4 font-medium">{t('campaignTitle')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('owner')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('store')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('status')}</th>
                <th className="text-center py-3 px-4 font-medium">{t('slots')}</th>
                <th className="text-left py-3 px-4 font-medium">{t('period')}</th>
                <th className="text-right py-3 px-4 font-medium">{t('budgetPerPost')}</th>
                <th className="text-center py-3 px-4 font-medium">{t('reservations')}</th>
              </tr>
            </thead>
            <tbody>
              {(data.campaigns || []).map((c: any) => {
                const isExpanded = expandedCampaign === c.id;
                const campaignReservations = reservations[c.id] || [];
                return (
                  <Fragment key={c.id}>
                    <tr
                      className="border-b border-white/5 hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => toggleCampaign(c.id)}
                    >
                      <td className="py-3 px-4">
                        <span className="text-slate-500 text-xs">
                          {isExpanded ? '▾' : '▸'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-200 font-medium max-w-[300px] truncate">{c.title}</div>
                        <div className="text-xs text-slate-500">{c.brandName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-300 text-[13px]">{c.ownerName || c.ownerEmail || c.ownerPhone || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[13px]">{c.storeName}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] || 'bg-slate-500/15 text-slate-400'}`}>
                          {campaignStatusLabel(c.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300">
                        {t('slotsUsed', { used: c.currentSlots || 0, total: c.slots })}
                      </td>
                      <td className="py-3 px-4 text-[13px] whitespace-nowrap">
                        <span className="text-slate-400">{c.startTimestamp ? formatDate(c.startTimestamp) : '—'}</span>
                        <span className="text-slate-500">{' — '}</span>
                        {editingCampaignEnd === c.id ? (
                          <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="datetime-local"
                              step="900"
                              value={newCampaignEnd}
                              onChange={(e) => setNewCampaignEnd(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateCampaignEnd(c.id); if (e.key === 'Escape') setEditingCampaignEnd(null); }}
                              autoFocus
                              className="px-2 py-0.5 text-xs bg-white/5 border border-blue-500/50 rounded text-slate-200 w-[170px]"
                            />
                            <button
                              onClick={() => handleUpdateCampaignEnd(c.id)}
                              className="px-1.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setEditingCampaignEnd(null)}
                              className="px-1.5 py-0.5 text-xs bg-white/5 text-slate-400 rounded hover:bg-white/10"
                            >
                              ✕
                            </button>
                          </span>
                        ) : (
                          <span
                            className="text-slate-400 hover:text-blue-400 cursor-pointer border-b border-dashed border-transparent hover:border-blue-400/50"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCampaignEnd(c.id);
                              setNewCampaignEnd(c.endTimestamp ? new Date(c.endTimestamp).toISOString().slice(0, 16) : '');
                            }}
                          >
                            {c.endTimestamp ? formatDate(c.endTimestamp) : '—'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300">
                        {c.reqBudgetPerPost ? formatCurrency(parseFloat(c.reqBudgetPerPost)) : '—'}
                        {c.paymentType === 'product_exchange' && (
                          <div className="text-[11px] text-violet-400">{paymentLabel(c.paymentType)}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                          {c.reservationCount || 0}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-white/5 bg-white/[0.015]">
                        <td></td>
                        <td colSpan={8} className="py-3 px-4">
                          {loadingReservations === c.id ? (
                            <div className="text-sm text-slate-500 py-4 text-center">Loading...</div>
                          ) : campaignReservations.length === 0 ? (
                            <div className="text-sm text-slate-500 py-4 text-center">{t('noReservations')}</div>
                          ) : (() => {
                            const rejectedCount = campaignReservations.filter((r: any) => r.status === 'rejected').length;
                            const showingRejected = showRejected.has(c.id);
                            const filtered = [...campaignReservations]
                              .filter((r: any) => showingRejected || r.status !== 'rejected')
                              .sort((a, b) => (a.status === 'used' ? -1 : b.status === 'used' ? 1 : 0));
                            return (
                            <>
                            <table className="text-sm">
                              <thead>
                                <tr className="text-slate-500 text-xs">
                                  <th className="text-left py-2 pr-6 font-medium">{t('creatorName')}</th>
                                  <th className="text-left py-2 pr-6 font-medium">{t('instagram')}</th>
                                  <th className="text-left py-2 pr-6 font-medium">{t('contact')}</th>
                                  <th className="text-left py-2 pr-6 font-medium">{t('reservationStatus')}</th>
                                  <th className="text-left py-2 pr-6 font-medium">{t('reservationExpiry')}</th>
                                  <th className="text-left py-2 pr-6 font-medium">{t('date')}</th>
                                  <th className="text-left py-2 font-medium"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.map((r: any) => (
                                  <tr key={r.id} className="border-t border-white/5">
                                    <td className="py-2 pr-6 text-slate-300 whitespace-nowrap">{r.creatorName || '—'}</td>
                                    <td className="py-2 pr-6 text-slate-400 text-xs whitespace-nowrap">{r.igUsername ? `@${r.igUsername}` : '—'}</td>
                                    <td className="py-2 pr-6 text-slate-500 text-xs whitespace-nowrap">{r.creatorEmail || r.creatorPhone || '—'}</td>
                                    <td className="py-2 pr-6 whitespace-nowrap">
                                      <span className={`text-xs px-2 py-0.5 rounded-full ${RESERVATION_COLORS[r.status] || 'bg-slate-500/15 text-slate-400'}`}>
                                        {reservationStatusLabel(r.status)}
                                      </span>
                                    </td>
                                    <td className="py-2 pr-6 text-[13px] whitespace-nowrap">
                                      {editingExpiry === r.id ? (
                                        <input
                                          type="datetime-local"
                                          step="900"
                                          value={newExpiry}
                                          onChange={(e) => setNewExpiry(e.target.value)}
                                          onClick={(e) => e.stopPropagation()}
                                          onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleUpdateExpiry(c.id, r.id); } if (e.key === 'Escape') { e.stopPropagation(); setEditingExpiry(null); } }}
                                          autoFocus
                                          className="px-2 py-1 text-xs bg-white/5 border border-blue-500/50 rounded text-slate-200 w-[180px]"
                                        />
                                      ) : (
                                        <span className="text-slate-400">{r.expireTimestamp ? formatDate(r.expireTimestamp) : '—'}</span>
                                      )}
                                    </td>
                                    <td className="py-2 pr-6 text-slate-500 text-xs whitespace-nowrap">
                                      {r.createTimestamp ? formatDate(r.createTimestamp) : '—'}
                                    </td>
                                    <td className="py-2">
                                      {editingExpiry === r.id ? (
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleUpdateExpiry(c.id, r.id); }}
                                            className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30"
                                          >
                                            OK
                                          </button>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setEditingExpiry(null); }}
                                            className="px-2 py-1 text-xs bg-white/5 text-slate-400 rounded hover:bg-white/10"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      ) : (r.status === 'booked' || r.status === 'boooked' || r.status === 'pending') && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingExpiry(r.id);
                                            setNewExpiry(r.expireTimestamp ? new Date(r.expireTimestamp).toISOString().slice(0, 16) : '');
                                          }}
                                          className="px-2 py-1 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                                        >
                                          {t('updateExpiry')}
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {rejectedCount > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowRejected((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(c.id)) next.delete(c.id);
                                    else next.add(c.id);
                                    return next;
                                  });
                                }}
                                className="mt-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                              >
                                {showingRejected ? t('hideRejected') : t('showRejected', { count: rejectedCount })}
                              </button>
                            )}
                            </>
                            );
                          })()}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {(!data.campaigns || data.campaigns.length === 0) && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">{t('noCampaignsFound')}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-white/5">
            <button
              onClick={() => fetchCampaigns(page - 1, search)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              {t('prev')}
            </button>
            <span className="text-sm text-slate-400">
              {t('pageOf', { page, total: totalPages })}
            </span>
            <button
              onClick={() => fetchCampaigns(page + 1, search)}
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
