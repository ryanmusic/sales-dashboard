import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';
import { useI18n } from '../i18n';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Bonus() {
  const { t } = useI18n();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingRes, setLoadingRes] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bonusAmount, setBonusAmount] = useState('');
  const [bonusDesc, setBonusDesc] = useState('全家加碼冠軍獎金');
  const [awarding, setAwarding] = useState(false);
  const [sortBy, setSortBy] = useState<'viewCount' | 'likeCount'>('viewCount');

  useEffect(() => {
    api.transactions.bonusCampaigns()
      .then(setCampaigns)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadReservations = async (campaignId: string) => {
    setSelectedCampaign(campaignId);
    setLoadingRes(true);
    setSelected(new Set());
    try {
      const res = await api.transactions.bonusReservations(campaignId);
      setReservations(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRes(false);
    }
  };

  const handleRefreshAll = async () => {
    if (!selectedCampaign) return;
    if (!confirm(t('confirmRefreshAll'))) return;
    setRefreshing(true);
    try {
      await api.transactions.refreshAllPosts(selectedCampaign);
      // Reload reservations to get updated stats
      const res = await api.transactions.bonusReservations(selectedCampaign);
      setReservations(res);
    } catch (err) {
      console.error(err);
      alert('Refresh failed');
    } finally {
      setRefreshing(false);
    }
  };

  const toggleSelect = (playerId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === reservations.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reservations.map((r) => r.playerId)));
    }
  };

  const handleAward = async () => {
    const amount = parseFloat(bonusAmount);
    if (!amount || amount <= 0 || selected.size === 0) return;
    const msg = t('confirmAward', { count: selected.size, amount: amount.toLocaleString() });
    if (!confirm(msg)) return;
    setAwarding(true);
    try {
      await api.transactions.award(Array.from(selected), amount, bonusDesc);
      alert(t('awardSuccess', { count: selected.size }));
      setSelected(new Set());
      setBonusAmount('');
    } catch (err: any) {
      alert(err.message || 'Failed to award');
    } finally {
      setAwarding(false);
    }
  };

  const sorted = [...reservations].sort((a, b) => {
    const av = parseInt(a[sortBy]) || 0;
    const bv = parseInt(b[sortBy]) || 0;
    return bv - av;
  });

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('bonusTitle')}</h2>

      {/* Campaign Selector */}
      <div className="bg-navy-900 border border-white/5 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-3">{t('bonusSelectCampaign')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {campaigns.map((c) => (
            <button
              key={c.id}
              onClick={() => loadReservations(c.id)}
              className={`text-left p-3 rounded-lg border transition-colors ${
                selectedCampaign === c.id
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  : 'bg-white/[0.02] border-white/5 text-slate-300 hover:bg-white/[0.04]'
              }`}
            >
              <div className="text-sm font-medium truncate" title={c.title}>{c.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">
                {c.storeName} · {c.status} · {c.slots} slots
                {c.endTimestamp && ` · ${formatDate(c.endTimestamp)}`}
              </div>
            </button>
          ))}
          {campaigns.length === 0 && (
            <div className="text-slate-500 text-sm col-span-3">{t('noCampaignsFound')}</div>
          )}
        </div>
      </div>

      {/* Reservation Table */}
      {selectedCampaign && (
        <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{t('bonusCreatorList')}</h3>
              <span className="text-xs text-slate-500">{reservations.length} {t('total')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortBy(sortBy === 'viewCount' ? 'likeCount' : 'viewCount')}
                className="px-3 py-1.5 text-xs bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 transition-colors"
              >
                {t('sortBy')}: {sortBy === 'viewCount' ? t('totalViews') : t('totalLikes')}
              </button>
              <button
                onClick={handleRefreshAll}
                disabled={refreshing}
                className="px-3 py-1.5 text-xs bg-blue-500/20 text-blue-400 rounded-lg hover:bg-blue-500/30 transition-colors disabled:opacity-50"
              >
                {refreshing ? t('refreshingAll') : t('refreshAll')}
              </button>
            </div>
          </div>

          {loadingRes ? (
            <div className="text-center text-slate-500 py-8">Loading...</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-400 text-xs border-b border-white/5">
                      <th className="py-2 pr-2 w-8">
                        <input
                          type="checkbox"
                          checked={selected.size === reservations.length && reservations.length > 0}
                          onChange={toggleAll}
                          className="rounded border-white/20 bg-white/5"
                        />
                      </th>
                      <th className="text-left py-2 pr-2 font-medium">{t('creatorName')}</th>
                      <th className="text-left py-2 pr-2 font-medium">{t('instagram')}</th>
                      <th className="text-left py-2 pr-2 font-medium">{t('reservationStatus')}</th>
                      <th className="text-left py-2 pr-2 font-medium">{t('submissionLabel')}</th>
                      <th className="text-right py-2 pr-2 font-medium">{t('totalViews')}</th>
                      <th className="text-right py-2 pr-2 font-medium">{t('totalLikes')}</th>
                      <th className="text-right py-2 pr-2 font-medium">{t('comments')}</th>
                      <th className="text-right py-2 pr-2 font-medium">{t('shares')}</th>
                      <th className="text-left py-2 font-medium">{t('postInfo')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((r, i) => (
                      <tr
                        key={r.id}
                        className={`border-b border-white/5 transition-colors ${
                          selected.has(r.playerId) ? 'bg-blue-500/[0.06]' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="py-1.5 pr-2">
                          <input
                            type="checkbox"
                            checked={selected.has(r.playerId)}
                            onChange={() => toggleSelect(r.playerId)}
                            className="rounded border-white/20 bg-white/5"
                          />
                        </td>
                        <td className="py-1.5 pr-2 text-slate-300 text-xs whitespace-nowrap">
                          <span className="text-slate-600 mr-1">#{i + 1}</span>
                          {r.creatorName || '—'}
                        </td>
                        <td className="py-1.5 pr-2 text-xs whitespace-nowrap">
                          {r.igUsername ? (
                            <a href={`https://instagram.com/${r.igUsername}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">@{r.igUsername}</a>
                          ) : '—'}
                        </td>
                        <td className="py-1.5 pr-2 whitespace-nowrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            r.status === 'used' ? 'bg-blue-500/15 text-blue-400'
                            : r.status === 'booked' || r.status === 'boooked' ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                          }`}>{r.status}</span>
                        </td>
                        <td className="py-1.5 pr-2 whitespace-nowrap">
                          {r.submissionStatus ? (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                              r.submissionStatus === 'accepted' ? 'bg-emerald-500/15 text-emerald-400'
                              : r.submissionStatus === 'rejected' ? 'bg-red-500/15 text-red-400'
                              : 'bg-amber-500/15 text-amber-400'
                            }`}>{r.submissionStatus}</span>
                          ) : <span className="text-slate-600 text-xs">—</span>}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-violet-400 text-xs">
                          {r.viewCount ? parseInt(r.viewCount).toLocaleString() : '—'}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-pink-400 text-xs">
                          {r.likeCount ? parseInt(r.likeCount).toLocaleString() : '—'}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-400 text-xs">
                          {r.commentCount ? parseInt(r.commentCount).toLocaleString() : '—'}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-400 text-xs">
                          {r.shareCount ? parseInt(r.shareCount).toLocaleString() : '—'}
                        </td>
                        <td className="py-1.5 text-xs">
                          {r.postUrl ? (
                            <a href={r.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300">{t('viewPost')}</a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                    {reservations.length === 0 && (
                      <tr><td colSpan={10} className="py-6 text-center text-slate-500">{t('noReservations')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Award Section */}
              {reservations.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-slate-400">{t('bonusSelected')}: <span className="text-blue-400 font-medium">{selected.size}</span></span>
                    <input
                      type="number"
                      value={bonusAmount}
                      onChange={(e) => setBonusAmount(e.target.value)}
                      placeholder={t('bonusAmountPlaceholder')}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 w-36 focus:outline-none focus:border-blue-500"
                    />
                    <input
                      type="text"
                      value={bonusDesc}
                      onChange={(e) => setBonusDesc(e.target.value)}
                      placeholder={t('bonusDescPlaceholder')}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 w-64 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleAward}
                      disabled={awarding || selected.size === 0 || !bonusAmount}
                      className="px-5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors text-sm"
                    >
                      {awarding ? t('awarding') : t('awardBonus')}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
