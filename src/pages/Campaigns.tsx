import { Fragment, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, formatDateTime, statusClass, statusLabel, subscriptionLabel } from '../lib/format';
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
  redeemed: 'bg-violet-500/15 text-violet-400',
};

export default function Campaigns() {
  const { t } = useI18n();
  const [data, setData] = useState<any>({ campaigns: [], total: 0, stats: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [expandedExpiring, setExpandedExpiring] = useState<string | null>(null);
  const [reservations, setReservations] = useState<Record<string, any[]>>({});
  const [loadingReservations, setLoadingReservations] = useState<string | null>(null);
  const [editingExpiry, setEditingExpiry] = useState<string | null>(null);
  const [newExpiry, setNewExpiry] = useState('');
  const [editingCampaignEnd, setEditingCampaignEnd] = useState<string | null>(null);
  const [newCampaignEnd, setNewCampaignEnd] = useState('');
  const [showRejected, setShowRejected] = useState<Set<string>>(new Set());
  const [detailCampaign, setDetailCampaign] = useState<any | null>(null);
  const [creatorLookup, setCreatorLookup] = useState<any | null>(null);
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [resubmitTarget, setResubmitTarget] = useState<{ campaignId: string; reservationId: string; creatorName: string } | null>(null);
  const [resubmitUrl, setResubmitUrl] = useState('');

  const fetchCampaigns = async (p: number, s: string, status?: string) => {
    const filter = status !== undefined ? status : statusFilter;
    const result = await api.campaigns.list(p, 50, s, filter);
    setData((prev: any) => ({ ...prev, campaigns: result.campaigns, total: result.total }));
    setPage(p);
  };

  useEffect(() => {
    api.campaigns.all()
      .then((d) => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadReservations = async (id: string) => {
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

  const toggleCampaign = async (id: string) => {
    if (expandedCampaign === id) {
      setExpandedCampaign(null);
      return;
    }
    setExpandedCampaign(id);
    await loadReservations(id);
  };

  const toggleExpiring = async (id: string) => {
    if (expandedExpiring === id) {
      setExpandedExpiring(null);
      return;
    }
    setExpandedExpiring(id);
    await loadReservations(id);
  };

  const handleUpdateExpiry = async (campaignId: string, reservationId: string) => {
    if (!newExpiry) return;
    if (!confirm(t('confirmChange'))) return;
    try {
      await api.campaigns.updateReservation(campaignId, reservationId, { expireTimestamp: new Date(newExpiry).toISOString() });
      const res = await api.campaigns.reservations(campaignId);
      setReservations((prev) => ({ ...prev, [campaignId]: res }));
      setEditingExpiry(null);
      setNewExpiry('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (campaignId: string, reservationId: string, newStatus: string) => {
    if (!confirm(t('confirmStatusChange', { status: reservationStatusLabel(newStatus) }))) return;
    try {
      await api.campaigns.updateReservation(campaignId, reservationId, { status: newStatus });
      const res = await api.campaigns.reservations(campaignId);
      setReservations((prev) => ({ ...prev, [campaignId]: res }));
      // Refresh campaign data to update slot counts
      const all = await api.campaigns.all();
      setData((prev: any) => ({ ...prev, stats: all.stats, expiring: all.expiring }));
    } catch (err: any) {
      const msg = err.message || 'Failed to update status';
      alert(msg.includes('No slots') ? t('noSlotsAvailable') : msg);
    }
  };

  const handleUpdateCampaignStatus = async (campaignId: string, newStatus: string) => {
    if (!confirm(t('confirmStatusChange', { status: campaignStatusLabel(newStatus) }))) return;
    try {
      await api.campaigns.updateCampaign(campaignId, { status: newStatus });
      setData((prev: any) => ({
        ...prev,
        campaigns: prev.campaigns.map((c: any) =>
          c.id === campaignId ? { ...c, status: newStatus } : c,
        ),
        expiring: (prev.expiring || []).map((c: any) =>
          c.id === campaignId ? { ...c, status: newStatus } : c,
        ),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateCampaignEnd = async (campaignId: string) => {
    if (!newCampaignEnd) return;
    if (!confirm(t('confirmChange'))) return;
    try {
      await api.campaigns.updateCampaign(campaignId, { endTimestamp: new Date(newCampaignEnd).toISOString() });
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

  const handleCreatorClick = async (playerId: string) => {
    setLoadingLookup(true);
    try {
      const result = await api.creators.lookup({ userId: playerId });
      setCreatorLookup(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleResubmit = async () => {
    if (!resubmitTarget || !resubmitUrl.trim()) return;
    if (!confirm(t('confirmChange'))) return;
    try {
      await api.campaigns.resubmitPost(resubmitTarget.campaignId, resubmitTarget.reservationId, resubmitUrl.trim());
      alert(t('resubmitSuccess'));
      setResubmitTarget(null);
      setResubmitUrl('');
      // Refresh reservations
      const res = await api.campaigns.reservations(resubmitTarget.campaignId);
      setReservations((prev) => ({ ...prev, [resubmitTarget.campaignId]: res }));
    } catch (err: any) {
      alert(err.message || 'Failed to resubmit');
    }
  };

  const getDisplayStatus = (r: any) => {
    if (r.redeemedTimestamp) return 'redeemed';
    return r.status;
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
      redeemed: t('reservationRedeemed'),
    };
    return map[status] || status;
  };

  const submissionStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      accepted: t('submissionAccepted'),
      pending_approval: t('reservationPending'),
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
            <span className="text-xs text-slate-500 ml-2">{(data.expiring as any[]).length} {t('total')}</span>
          </div>
          <p className="text-xs text-slate-500 mb-3">{t('expiringCampaignsSubtitle')}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-white/5">
                  <th className="text-left py-2 pr-2 font-medium">{t('store')}</th>
                  <th className="text-left py-2 pr-2 font-medium">{t('campaignTitle')}</th>
                  <th className="text-center py-2 pr-2 font-medium">{t('remainingSlots')}</th>
                  <th className="text-center py-2 pr-2 font-medium">{t('pendingLabel')}</th>
                  <th className="text-center py-2 pr-2 font-medium">{t('reservationBooked')}</th>
                  <th className="text-center py-2 pr-2 font-medium">{t('reservationUsed')}</th>
                  <th className="text-center py-2 pr-2 font-medium">{t('submissionAccepted')}</th>
                  <th className="text-left py-2 pr-2 font-medium">{t('plan')}</th>
                  <th className="text-center py-2 pr-2 font-medium">{t('remainingDays')}</th>
                  <th className="text-left py-2 pr-2 font-medium">{t('advertiser')}</th>
                  <th className="text-left py-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {(data.expiring as any[]).map((c: any) => {
                  const diffMs = new Date(c.endTimestamp).getTime() - Date.now();
                  const days = Math.ceil(diffMs / 86400000);
                  const overdue = days < 0;
                  const absDays = Math.abs(days);
                  const occupied = parseInt(c.occupiedSlots || c.currentSlots || 0);
                  const remaining = (c.slots || 0) - occupied;
                  const full = remaining <= 0;
                  const urgent = !full && (overdue || days <= 3);
                  const isExpanded = expandedExpiring === c.id;
                  const campaignReservations = reservations[c.id] || [];
                  return (
                    <Fragment key={c.id}>
                      <tr
                        className={`border-b border-white/5 cursor-pointer hover:bg-white/[0.02] transition-colors ${
                          full ? 'bg-emerald-500/[0.05]' : urgent ? 'bg-red-500/[0.03]' : ''
                        }`}
                        onClick={() => toggleExpiring(c.id)}
                      >
                        <td className="py-1.5 pr-2 text-slate-300 whitespace-nowrap">{c.storeName}</td>
                        <td className="py-1.5 pr-2 max-w-[160px]">
                          <span className="text-slate-200 truncate block max-w-[160px]" title={c.title}>{c.title}</span>
                        </td>
                        <td className={`py-1.5 pr-2 text-center font-medium ${full ? 'text-emerald-400' : remaining <= 2 ? 'text-red-400' : 'text-slate-300'}`}>{remaining}/{c.slots}</td>
                        <td className={`py-1.5 pr-2 text-center ${parseInt(c.pendingCount) > 0 ? 'text-amber-400 bg-amber-500/10 font-medium' : 'text-slate-500'}`}>{c.pendingCount || 0}</td>
                        <td className="py-1.5 pr-2 text-center text-slate-300">{c.bookedCount || 0}</td>
                        <td className="py-1.5 pr-2 text-center text-blue-400">{c.usedCount || 0}</td>
                        <td className="py-1.5 pr-2 text-center text-emerald-400">{c.acceptedSubmissions || 0}</td>
                        <td className="py-1.5 pr-2 text-slate-400 whitespace-nowrap">{subscriptionLabel(c.subscriptionLevel || 'free', t)}</td>
                        <td className="py-1.5 pr-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full ${
                            overdue ? 'bg-red-500/15 text-red-400' : days <= 7 ? 'bg-red-500/10 text-red-300' : 'bg-amber-500/15 text-amber-400'
                          }`}>
                            {overdue ? `-${absDays}d` : `${days}d`}
                          </span>
                        </td>
                        <td className="py-1.5 pr-2 text-slate-500 whitespace-nowrap">{c.ownerName || c.ownerEmail || '—'}</td>
                        <td className="py-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailCampaign(c); }}
                            className="text-slate-500 hover:text-blue-400 transition-colors"
                            title={t('campaignDetails')}
                          >
                            ⓘ
                          </button>
                        </td>
                      </tr>
                  {isExpanded && (
                    <tr className="border-b border-white/5 bg-white/[0.015]">
                    <td colSpan={11} className="px-3 pb-3 pt-1">
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
                        const totalViews = campaignReservations.reduce((s: number, r: any) => s + (parseInt(r.postViews) || 0), 0);
                        const totalLikes = campaignReservations.reduce((s: number, r: any) => s + (parseInt(r.postLikes) || 0), 0);
                        const acceptedCount = campaignReservations.filter((r: any) => r.submissionStatus === 'accepted').length;
                        const bookedCount = campaignReservations.filter((r: any) => ['booked', 'boooked', 'pending', 'used'].includes(r.status)).length;
                        return (
                          <>
                            <div className="flex items-center gap-4 mb-2 text-xs">
                              <span className="text-slate-400">{t('totalSlots')}: <span className="text-slate-200 font-medium">{c.slots}</span></span>
                              <span className="text-slate-400">{t('reservationBooked')}: <span className="text-emerald-400 font-medium">{bookedCount}</span></span>
                              <span className="text-slate-400">{t('submissionAccepted')}: <span className="text-blue-400 font-medium">{acceptedCount}</span></span>
                              {totalViews > 0 && <span className="text-slate-400">{t('totalViews')}: <span className="text-violet-400 font-medium">{totalViews.toLocaleString()}</span></span>}
                              {totalLikes > 0 && <span className="text-slate-400">{t('totalLikes')}: <span className="text-pink-400 font-medium">{totalLikes.toLocaleString()}</span></span>}
                            </div>
                            <table className="text-sm mt-1">
                              <thead>
                                <tr className="text-slate-500 text-xs">
                                  <th className="text-left py-1.5 pr-4 font-medium">{t('creatorName')}</th>
                                  <th className="text-left py-1.5 pr-4 font-medium">{t('instagram')}</th>
                                  <th className="text-left py-1.5 pr-4 font-medium">{t('reservationStatus')}</th>
                                  <th className="text-left py-1.5 pr-4 font-medium">{t('approvedAt')}</th>
                                  <th className="text-left py-1.5 pr-4 font-medium">{t('reservationExpiry')}</th>
                                  <th className="text-left py-1.5 pr-4 font-medium">{t('postInfo')}</th>
                                  <th className="text-left py-1.5 font-medium"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.map((r: any) => (
                                  <tr key={r.id} className="border-t border-white/5">
                                    <td className="py-1.5 pr-4 text-slate-300 text-xs whitespace-nowrap">{r.creatorName || '—'}</td>
                                    <td className="py-1.5 pr-4 text-slate-400 text-xs whitespace-nowrap">{r.igUsername ? <a href={`https://instagram.com/${r.igUsername}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="hover:text-blue-400 transition-colors">@{r.igUsername}</a> : '—'}</td>
                                    <td className="py-1.5 pr-4 whitespace-nowrap">
                                      <select
                                        value={r.status}
                                        onChange={(e) => { e.stopPropagation(); handleUpdateStatus(c.id, r.id, e.target.value); }}
                                        onClick={(e) => e.stopPropagation()}
                                        className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${RESERVATION_COLORS[r.status] || 'bg-slate-500/15 text-slate-400'}`}
                                      >
                                        {['booked', 'pending', 'used', 'expired', 'canceled', 'rejected'].map((s) => (
                                          <option key={s} value={s} className="bg-navy-900 text-slate-200">{reservationStatusLabel(s)}</option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="py-1.5 pr-4 text-xs text-slate-400 whitespace-nowrap">{r.approvedAt ? formatDateTime(r.approvedAt) : '—'}</td>
                                    <td className="py-1.5 pr-4 text-xs whitespace-nowrap">
                                      {editingExpiry === r.id ? (
                                        <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="datetime-local"
                                            step="900"
                                            value={newExpiry}
                                            onChange={(e) => setNewExpiry(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateExpiry(c.id, r.id); if (e.key === 'Escape') setEditingExpiry(null); }}
                                            autoFocus
                                            className="px-2 py-0.5 text-xs bg-white/5 border border-blue-500/50 rounded text-slate-200 w-[170px]"
                                          />
                                          <button
                                            onClick={() => handleUpdateExpiry(c.id, r.id)}
                                            className="px-1.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30"
                                          >
                                            OK
                                          </button>
                                          <button
                                            onClick={() => setEditingExpiry(null)}
                                            className="px-1.5 py-0.5 text-xs bg-white/5 text-slate-400 rounded hover:bg-white/10"
                                          >
                                            ✕
                                          </button>
                                        </span>
                                      ) : (
                                        <span className="text-slate-400">{r.expireTimestamp ? formatDateTime(r.expireTimestamp) : '—'}</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 pr-4 text-xs whitespace-nowrap">
                                      {r.postUrl ? (
                                        <span className="inline-flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                          <a href={r.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">{t('viewPost')}</a>
                                          <span className="text-slate-500">{r.postViews ? `${r.postViews}v` : ''}{r.postLikes ? ` ${r.postLikes}♥` : ''}</span>
                                        </span>
                                      ) : '—'}
                                    </td>
                                    <td className="py-1.5 whitespace-nowrap">
                                      {editingExpiry !== r.id && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setEditingExpiry(r.id);
                                            setNewExpiry(r.expireTimestamp ? new Date(r.expireTimestamp).toISOString().slice(0, 16) : '');
                                          }}
                                          className="px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
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
                                  setShowRejected(prev => {
                                    const next = new Set(prev);
                                    if (next.has(c.id)) next.delete(c.id);
                                    else next.add(c.id);
                                    return next;
                                  });
                                }}
                                className="mt-2 text-xs text-slate-500 hover:text-slate-400 transition-colors"
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
              </tbody>
            </table>
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
                        <div className="flex items-center gap-2">
                          <span className="text-slate-200 font-medium max-w-[200px] truncate block" title={c.title}>{c.title}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setDetailCampaign(c); }}
                            className="text-slate-500 hover:text-blue-400 transition-colors text-xs shrink-0"
                            title={t('campaignDetails')}
                          >
                            ⓘ
                          </button>
                        </div>
                        <div className="text-xs text-slate-500">{c.brandName}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="text-slate-300 text-[13px]">{c.ownerName || c.ownerEmail || c.ownerPhone || '—'}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-400 text-[13px]">{c.storeName}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          value={c.status}
                          onChange={(e) => handleUpdateCampaignStatus(c.id, e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${STATUS_COLORS[c.status] || 'bg-slate-500/15 text-slate-400'}`}
                        >
                          {['active', 'pending', 'expired', 'concluded', 'archived'].map((s) => (
                            <option key={s} value={s} className="bg-navy-900 text-slate-200">{campaignStatusLabel(s)}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-300">
                        {t('slotsUsed', { used: (c.slots || 0) - parseInt(c.occupiedSlots || 0), total: c.slots })}
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
                            const totalViews = campaignReservations.reduce((s: number, r: any) => s + (parseInt(r.postViews) || 0), 0);
                            const totalLikes = campaignReservations.reduce((s: number, r: any) => s + (parseInt(r.postLikes) || 0), 0);
                            const acceptedCount = campaignReservations.filter((r: any) => r.submissionStatus === 'accepted').length;
                            const bookedCount = campaignReservations.filter((r: any) => ['booked', 'boooked', 'pending', 'used'].includes(r.status)).length;
                            return (
                            <>
                            <div className="flex items-center gap-4 mb-3 text-xs">
                              <span className="text-slate-400">{t('totalSlots')}: <span className="text-slate-200 font-medium">{c.slots}</span></span>
                              <span className="text-slate-400">{t('reservationBooked')}: <span className="text-emerald-400 font-medium">{bookedCount}</span></span>
                              <span className="text-slate-400">{t('submissionAccepted')}: <span className="text-blue-400 font-medium">{acceptedCount}</span></span>
                              {totalViews > 0 && <span className="text-slate-400">{t('totalViews')}: <span className="text-violet-400 font-medium">{totalViews.toLocaleString()}</span></span>}
                              {totalLikes > 0 && <span className="text-slate-400">{t('totalLikes')}: <span className="text-pink-400 font-medium">{totalLikes.toLocaleString()}</span></span>}
                            </div>
                            <table className="text-sm">
                              <thead>
                                <tr className="text-slate-500 text-xs">
                                  <th className="text-left py-1.5 pr-2 font-medium">{t('creatorName')}</th>
                                  <th className="text-left py-1.5 pr-2 font-medium">{t('instagram')}</th>
                                  <th className="text-left py-1.5 pr-2 font-medium">{t('contact')}</th>
                                  <th className="text-left py-1.5 pr-2 font-medium">{t('reservationStatus')}</th>
                                  <th className="text-left py-1.5 pr-2 font-medium">{t('approvedAt')}</th>
                                  <th className="text-left py-1.5 pr-2 font-medium">{t('redeemedAt')}</th>
                                  <th className="text-left py-1.5 pr-2 font-medium">{t('reservationExpiry')}</th>
                                  <th className="text-left py-1.5 pr-2 font-medium">{t('postInfo')}</th>
                                  <th className="text-left py-1.5 pr-2 font-medium">{t('date')}</th>
                                  <th className="text-left py-1.5 font-medium"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {filtered.map((r: any) => (
                                  <tr key={r.id} className="border-t border-white/5">
                                    <td className="py-1 pr-2 max-w-[80px]">
                                      <button onClick={(e) => { e.stopPropagation(); handleCreatorClick(r.playerId); }} className="text-slate-300 hover:text-blue-400 transition-colors cursor-pointer text-xs truncate block max-w-[80px]" title={r.creatorName}>{r.creatorName || '—'}</button>
                                    </td>
                                    <td className="py-1 pr-2 text-slate-400 text-xs whitespace-nowrap">{r.igUsername ? <a href={`https://instagram.com/${r.igUsername}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="hover:text-blue-400 transition-colors">@{r.igUsername}</a> : '—'}</td>
                                    <td className="py-1 pr-2 text-slate-500 text-xs whitespace-nowrap">{r.creatorEmail || r.creatorPhone || '—'}</td>
                                    <td className="py-1 pr-2 whitespace-nowrap">
                                      {(() => { const ds = getDisplayStatus(r); return (
                                        <span className="inline-flex items-center gap-1">
                                          <select
                                            value={r.status}
                                            onChange={(e) => { e.stopPropagation(); handleUpdateStatus(c.id, r.id, e.target.value); }}
                                            onClick={(e) => e.stopPropagation()}
                                            className={`text-xs px-1.5 py-0.5 rounded-full border-0 cursor-pointer ${RESERVATION_COLORS[ds] || 'bg-slate-500/15 text-slate-400'}`}
                                          >
                                            {['booked', 'pending', 'used', 'expired', 'canceled', 'rejected'].map((s) => (
                                              <option key={s} value={s} className="bg-navy-900 text-slate-200">{reservationStatusLabel(s)}</option>
                                            ))}
                                          </select>
                                          {ds === 'redeemed' && <span className="text-[10px] px-1 py-0.5 rounded-full bg-violet-500/15 text-violet-400">{t('reservationRedeemed')}</span>}
                                        </span>
                                      );})()}
                                    </td>
                                    <td className="py-1 pr-2 text-xs text-slate-400 whitespace-nowrap">{r.approvedAt ? formatDateTime(r.approvedAt) : '—'}</td>
                                    <td className="py-1 pr-2 text-xs text-slate-400 whitespace-nowrap">{r.redeemedTimestamp ? formatDateTime(r.redeemedTimestamp) : '—'}</td>
                                    <td className="py-1 pr-2 text-xs whitespace-nowrap">
                                      {editingExpiry === r.id ? (
                                        <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="datetime-local"
                                            step="900"
                                            value={newExpiry}
                                            onChange={(e) => setNewExpiry(e.target.value)}
                                            onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleUpdateExpiry(c.id, r.id); } if (e.key === 'Escape') { e.stopPropagation(); setEditingExpiry(null); } }}
                                            autoFocus
                                            className="px-1.5 py-0.5 text-xs bg-white/5 border border-blue-500/50 rounded text-slate-200 w-[170px]"
                                          />
                                          <button onClick={() => handleUpdateExpiry(c.id, r.id)} className="px-1.5 py-0.5 text-xs bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30">OK</button>
                                          <button onClick={() => setEditingExpiry(null)} className="px-1 py-0.5 text-xs text-slate-400 hover:text-slate-200">✕</button>
                                        </span>
                                      ) : (
                                        <span
                                          className="text-slate-400 cursor-pointer hover:text-blue-400 transition-colors"
                                          onClick={(e) => { e.stopPropagation(); setEditingExpiry(r.id); setNewExpiry(r.expireTimestamp ? new Date(r.expireTimestamp).toISOString().slice(0, 16) : ''); }}
                                        >
                                          {r.expireTimestamp ? formatDateTime(r.expireTimestamp) : '—'}
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-1 pr-2 text-xs whitespace-nowrap">
                                      {r.postUrl ? (
                                        <span className="inline-flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                          <a href={r.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors">{t('viewPost')}</a>
                                          <span className="text-slate-500">{r.postViews ? `${r.postViews}v` : ''}{r.postLikes ? ` ${r.postLikes}♥` : ''}</span>
                                        </span>
                                      ) : '—'}
                                    </td>
                                    <td className="py-1 pr-2 text-slate-500 text-xs whitespace-nowrap">
                                      {r.createTimestamp ? formatDate(r.createTimestamp) : '—'}
                                    </td>
                                    <td className="py-1">
                                      {r.submissionId && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setResubmitTarget({ campaignId: c.id, reservationId: r.id, creatorName: r.creatorName || r.igUsername || '—' }); }}
                                          className="px-1.5 py-0.5 text-xs bg-violet-500/20 text-violet-400 rounded hover:bg-violet-500/30 transition-colors"
                                        >
                                          {t('resubmit')}
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

      {/* Campaign Detail Modal */}
      {detailCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDetailCampaign(null)}>
          <div className="bg-navy-900 border border-white/10 rounded-xl w-full max-w-7xl max-h-[80vh] overflow-y-auto mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-200">{t('campaignDetails')}</h3>
              <button onClick={() => setDetailCampaign(null)} className="text-slate-500 hover:text-slate-300 text-lg">✕</button>
            </div>

            {/* Top info grid */}
            <div className="grid grid-cols-4 gap-6 mb-6">
              <div className="col-span-2">
                <div className="text-xs text-slate-500 mb-1">{t('campaignTitle')}</div>
                <div className="text-slate-200 font-medium">{detailCampaign.title}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('store')}</div>
                <div className="text-slate-300 text-sm">{detailCampaign.storeName}</div>
                {detailCampaign.redeemCode && <div className="text-xs text-slate-500 mt-0.5">{t('redeemCode')}: <span className="text-amber-400 font-mono">{detailCampaign.redeemCode}</span></div>}
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('owner')}</div>
                <div className="text-slate-300 text-sm">{detailCampaign.ownerName || '—'}</div>
                {detailCampaign.ownerEmail && <div className="text-slate-500 text-xs mt-0.5">{detailCampaign.ownerEmail}</div>}
                {detailCampaign.ownerPhone && <div className="text-slate-500 text-xs mt-0.5">{detailCampaign.ownerPhone}</div>}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-6 mb-6">
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('status')}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[detailCampaign.status] || 'bg-slate-500/15 text-slate-400'}`}>
                  {campaignStatusLabel(detailCampaign.status)}
                </span>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('slots')}</div>
                <div className="text-slate-300 text-sm">{t('slotsUsed', { used: (detailCampaign.slots || 0) - parseInt(detailCampaign.occupiedSlots || 0), total: detailCampaign.slots })}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('budgetPerPost')}</div>
                <div className="text-slate-300 text-sm">
                  {detailCampaign.paymentType === 'cash' || detailCampaign.reqBudgetPerPost
                    ? detailCampaign.reqBudgetPerPost ? formatCurrency(parseFloat(detailCampaign.reqBudgetPerPost)) : '—'
                    : detailCampaign.productExchangeDescription || '商品交換'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('period')}</div>
                <div className="text-slate-300 text-sm">
                  {detailCampaign.startTimestamp && detailCampaign.endTimestamp
                    ? `${formatDate(detailCampaign.startTimestamp)} — ${formatDate(detailCampaign.endTimestamp)}`
                    : detailCampaign.endTimestamp
                      ? `~ ${formatDate(detailCampaign.endTimestamp)}`
                      : '—'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('platforms')}</div>
                <div className="text-slate-300 text-sm">{detailCampaign.acceptedPlatforms?.replace(/[{}]/g, '') || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500 mb-1">{t('reservationScreening')}</div>
                <div className={`text-sm ${detailCampaign.enableReservationScreening ? 'text-amber-400' : 'text-slate-400'}`}>
                  {detailCampaign.enableReservationScreening ? t('yes') : t('no')}
                </div>
              </div>
            </div>

            {detailCampaign.isFreeProductIncluded && (
              <div className="grid grid-cols-5 gap-6 mb-6">
                <div>
                  <div className="text-xs text-slate-500 mb-1">{t('freeProduct')}</div>
                  <div className="text-emerald-400 text-sm">{t('yes')}</div>
                </div>
                {detailCampaign.freeProductValue > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 mb-1">{t('freeProductValue')}</div>
                    <div className="text-slate-300 text-sm">{formatCurrency(detailCampaign.freeProductValue)}</div>
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-white/5 pt-5 grid grid-cols-2 gap-6">
              {detailCampaign.invitationMsg && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">{t('invitationMessage')}</div>
                  <div className="text-slate-300 text-sm whitespace-pre-wrap bg-white/[0.03] rounded-lg p-3 border border-white/5">{detailCampaign.invitationMsg}</div>
                </div>
              )}

              {detailCampaign.missionReq && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">{t('missionRequirement')}</div>
                  <div className="text-slate-300 text-sm whitespace-pre-wrap bg-white/[0.03] rounded-lg p-3 border border-white/5">{detailCampaign.missionReq}</div>
                </div>
              )}

              {detailCampaign.productExchangeDescription && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">{t('productExchangeDesc')}</div>
                  <div className="text-slate-300 text-sm whitespace-pre-wrap bg-white/[0.03] rounded-lg p-3 border border-white/5">{detailCampaign.productExchangeDescription}</div>
                </div>
              )}

              {detailCampaign.requiredHashtags && (
                <div>
                  <div className="text-xs text-slate-500 mb-1">{t('requiredHashtags')}</div>
                  <div className="text-blue-400 text-sm bg-white/[0.03] rounded-lg p-3 border border-white/5">{detailCampaign.requiredHashtags}</div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setDetailCampaign(null)}
                className="px-4 py-2 text-sm bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-colors"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Creator Lookup Modal */}
      {(creatorLookup || loadingLookup) && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4" onClick={() => { setCreatorLookup(null); setLoadingLookup(false); }}>
          <div className="bg-navy-900 border border-white/10 rounded-xl p-6 max-w-4xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {loadingLookup ? (
              <div className="text-center text-slate-400 py-8">Loading...</div>
            ) : creatorLookup?.user ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{creatorLookup.user.fullName || '—'}</h3>
                    <div className="text-sm text-slate-400">
                      {creatorLookup.user.igUsername && <a href={`https://instagram.com/${creatorLookup.user.igUsername}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">@{creatorLookup.user.igUsername}</a>}
                      {creatorLookup.user.followers && <span className="text-slate-500 ml-2">{parseInt(creatorLookup.user.followers).toLocaleString()} followers</span>}
                      <span className="text-slate-600 ml-2">{creatorLookup.user.email}</span>
                      <span className="text-slate-600 ml-2">{creatorLookup.user.phoneNumber}</span>
                    </div>
                  </div>
                  <button onClick={() => setCreatorLookup(null)} className="text-slate-400 hover:text-slate-200 text-xl">✕</button>
                </div>

                {/* Reservations */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">{t('tab_reservations')} ({creatorLookup.reservations.length})</h4>
                  {creatorLookup.reservations.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead><tr className="text-slate-500 border-b border-white/5">
                        <th className="text-left py-1.5 pr-3">{t('campaignTitle')}</th>
                        <th className="text-left py-1.5 pr-3">{t('store')}</th>
                        <th className="text-left py-1.5 pr-3">{t('status')}</th>
                        <th className="text-left py-1.5 pr-3">{t('approvedAt')}</th>
                        <th className="text-left py-1.5">{t('reservationExpiry')}</th>
                      </tr></thead>
                      <tbody>
                        {creatorLookup.reservations.map((r: any) => (
                          <tr key={r.id} className="border-t border-white/5">
                            <td className="py-1.5 pr-3 text-slate-200">{r.campaignTitle}</td>
                            <td className="py-1.5 pr-3 text-slate-400">{r.storeName}</td>
                            <td className="py-1.5 pr-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full ${RESERVATION_COLORS[r.status] || 'bg-slate-500/15 text-slate-400'}`}>{reservationStatusLabel(r.status)}</span></td>
                            <td className="py-1.5 pr-3 text-slate-400">{r.approvedAt ? formatDateTime(r.approvedAt) : '—'}</td>
                            <td className="py-1.5 text-slate-400">{r.expireTimestamp ? formatDateTime(r.expireTimestamp) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="text-slate-500 text-xs">{t('noResults')}</div>}
                </div>

                {/* Submissions */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-400 mb-2">{t('tab_submissions')} ({creatorLookup.submissions.length})</h4>
                  {creatorLookup.submissions.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead><tr className="text-slate-500 border-b border-white/5">
                        <th className="text-left py-1.5 pr-3">{t('campaignTitle')}</th>
                        <th className="text-left py-1.5 pr-3">{t('status')}</th>
                        <th className="text-left py-1.5 pr-3">{t('postInfo')}</th>
                        <th className="text-right py-1.5 pr-3">{t('totalViews')}</th>
                        <th className="text-right py-1.5 pr-3">{t('totalLikes')}</th>
                        <th className="text-left py-1.5">{t('actions')}</th>
                      </tr></thead>
                      <tbody>
                        {creatorLookup.submissions.map((s: any) => {
                          const matchingRes = creatorLookup.reservations.find((r: any) => r.campaignId === s.callCardId || r.callCardId === s.callCardId);
                          return (
                          <tr key={s.id} className="border-t border-white/5">
                            <td className="py-1.5 pr-3 text-slate-200">{s.campaignTitle}</td>
                            <td className="py-1.5 pr-3 whitespace-nowrap"><span className={`px-2 py-0.5 rounded-full ${s.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-400' : s.status === 'rejected' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>{submissionStatusLabel(s.status)}</span></td>
                            <td className="py-1.5 pr-3">{s.postUrl ? <a href={s.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{t('viewPost')}</a> : '—'}</td>
                            <td className="py-1.5 pr-3 text-right text-violet-400 font-mono">{s.viewCount ? parseInt(s.viewCount).toLocaleString() : '—'}</td>
                            <td className="py-1.5 pr-3 text-right text-pink-400 font-mono">{s.likeCount ? parseInt(s.likeCount).toLocaleString() : '—'}</td>
                            <td className="py-1.5">
                              {matchingRes && (
                                <button
                                  onClick={() => { setResubmitTarget({ campaignId: s.callCardId, reservationId: matchingRes.id, creatorName: creatorLookup.user.fullName || creatorLookup.user.igUsername || '—' }); }}
                                  className="px-1.5 py-0.5 text-xs bg-violet-500/20 text-violet-400 rounded hover:bg-violet-500/30 transition-colors"
                                >
                                  {t('resubmit')}
                                </button>
                              )}
                            </td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  ) : <div className="text-slate-500 text-xs">{t('noResults')}</div>}
                </div>

                {/* Payouts */}
                <div>
                  <h4 className="text-sm font-medium text-slate-400 mb-2">{t('tab_payouts')} ({creatorLookup.payouts.length})</h4>
                  {creatorLookup.payouts.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead><tr className="text-slate-500 border-b border-white/5">
                        <th className="text-left py-1.5 pr-3">{t('date')}</th>
                        <th className="text-right py-1.5 pr-3">{t('amount')}</th>
                        <th className="text-right py-1.5 pr-3">{t('net')}</th>
                        <th className="text-left py-1.5">{t('status')}</th>
                      </tr></thead>
                      <tbody>
                        {creatorLookup.payouts.map((p: any) => (
                          <tr key={p.id} className="border-t border-white/5">
                            <td className="py-1.5 pr-3 text-slate-400">{formatDate(p.createTimestamp)}</td>
                            <td className="py-1.5 pr-3 text-right font-mono text-slate-300">{formatCurrency(parseFloat(p.amount))}</td>
                            <td className="py-1.5 pr-3 text-right font-mono text-emerald-400">{p.net ? formatCurrency(parseFloat(p.net)) : '—'}</td>
                            <td className="py-1.5"><span className={`badge ${statusClass(p.status)}`}>{statusLabel(p.status, t)}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : <div className="text-slate-500 text-xs">{t('noResults')}</div>}
                </div>
              </>
            ) : <div className="text-center text-slate-500 py-8">{t('noUserFound')}</div>}
          </div>
        </div>
      )}

      {/* Resubmit Modal */}
      {resubmitTarget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-4" onClick={() => setResubmitTarget(null)}>
          <div className="bg-navy-900 border border-white/10 rounded-xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-2">{t('resubmitPost')}</h3>
            <p className="text-sm text-slate-400 mb-4">{t('resubmitDesc', { creator: resubmitTarget.creatorName })}</p>
            <input
              type="text"
              value={resubmitUrl}
              onChange={(e) => setResubmitUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleResubmit()}
              placeholder="https://www.instagram.com/p/... or /reel/..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-slate-200 mb-4 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setResubmitTarget(null)} className="px-4 py-2 text-sm bg-white/5 text-slate-400 rounded-lg hover:bg-white/10">{t('close')}</button>
              <button onClick={handleResubmit} disabled={!resubmitUrl.trim()} className="px-4 py-2 text-sm bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-40">{t('resubmit')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
