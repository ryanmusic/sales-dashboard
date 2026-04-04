import { useState } from 'react';
import { api } from '../lib/api';
import { formatCurrency, formatDate, formatDateTime, statusClass, statusLabel } from '../lib/format';
import { useI18n } from '../i18n';

const RES_COLORS: Record<string, string> = {
  booked: 'bg-emerald-500/15 text-emerald-400',
  boooked: 'bg-emerald-500/15 text-emerald-400',
  pending: 'bg-amber-500/15 text-amber-400',
  used: 'bg-blue-500/15 text-blue-400',
  expired: 'bg-slate-500/15 text-slate-400',
  canceled: 'bg-red-500/15 text-red-400',
  rejected: 'bg-red-500/15 text-red-400',
};

export default function Support() {
  const { t } = useI18n();
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'reservations' | 'submissions' | 'payouts'>('reservations');

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setLoading(true);
    setData(null);
    try {
      const input = searchInput.trim();
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}/.test(input);
      const result = await api.creators.lookup(isUuid ? { userId: input } : { ig: input });
      setData(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('supportTitle')}</h2>

      {/* Search */}
      <div className="bg-navy-900 border border-white/5 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold mb-3">{t('creatorLookup')}</h3>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('lookupPlaceholder')}
            className="flex-1 max-w-md bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleSearch}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium rounded-lg transition-colors text-sm"
          >
            {loading ? t('searching') : t('search')}
          </button>
        </div>
      </div>

      {data && !data.user && (
        <div className="bg-navy-900 border border-white/5 rounded-xl p-6 text-center text-slate-500">
          {t('noUserFound')}
        </div>
      )}

      {data?.user && (
        <>
          {/* User Profile */}
          <div className="bg-navy-900 border border-white/5 rounded-xl p-6 mb-6">
            <div className="flex items-center gap-6">
              <div>
                <div className="text-lg font-semibold text-slate-200">{data.user.fullName || '—'}</div>
                {data.user.igUsername && (
                  <a href={`https://instagram.com/${data.user.igUsername}`} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm">
                    @{data.user.igUsername}
                    {data.user.followers && <span className="text-slate-500 ml-1">({parseInt(data.user.followers).toLocaleString()} followers)</span>}
                  </a>
                )}
              </div>
              <div className="text-sm text-slate-400">{data.user.email}</div>
              <div className="text-sm text-slate-400">{data.user.phoneNumber}</div>
              <div className="text-xs text-slate-600 font-mono">{data.user.id}</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-4">
            {(['reservations', 'submissions', 'payouts'] as const).map((t2) => (
              <button
                key={t2}
                onClick={() => setTab(t2)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  tab === t2 ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                }`}
              >
                {t(`tab_${t2}`)} ({data[t2].length})
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-navy-900 border border-white/5 rounded-xl p-6">
            {tab === 'reservations' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-white/5">
                    <th className="text-left py-2 px-3 font-medium">{t('campaignTitle')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('store')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('status')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('date')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('approvedAt')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('reservationExpiry')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.reservations.map((r: any) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2 px-3 text-slate-200">{r.campaignTitle}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{r.storeName}</td>
                      <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${RES_COLORS[r.status] || 'bg-slate-500/15 text-slate-400'}`}>{r.status}</span></td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{formatDate(r.createTimestamp)}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{r.approvedAt ? formatDateTime(r.approvedAt) : '—'}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{r.expireTimestamp ? formatDateTime(r.expireTimestamp) : '—'}</td>
                    </tr>
                  ))}
                  {data.reservations.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">{t('noResults')}</td></tr>}
                </tbody>
              </table>
            )}

            {tab === 'submissions' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-white/5">
                    <th className="text-left py-2 px-3 font-medium">{t('campaignTitle')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('status')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('postInfo')}</th>
                    <th className="text-right py-2 px-3 font-medium">{t('totalViews')}</th>
                    <th className="text-right py-2 px-3 font-medium">{t('totalLikes')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.submissions.map((s: any) => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2 px-3 text-slate-200">{s.campaignTitle}</td>
                      <td className="py-2 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-400' : s.status === 'rejected' ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>{s.status}</span></td>
                      <td className="py-2 px-3">{s.postUrl ? <a href={s.postUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-xs">{t('viewPost')}</a> : '—'}</td>
                      <td className="py-2 px-3 text-right text-violet-400 font-mono text-xs">{s.viewCount ? parseInt(s.viewCount).toLocaleString() : '—'}</td>
                      <td className="py-2 px-3 text-right text-pink-400 font-mono text-xs">{s.likeCount ? parseInt(s.likeCount).toLocaleString() : '—'}</td>
                      <td className="py-2 px-3 text-slate-400 text-xs">{formatDate(s.createTimestamp)}</td>
                    </tr>
                  ))}
                  {data.submissions.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">{t('noResults')}</td></tr>}
                </tbody>
              </table>
            )}

            {tab === 'payouts' && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-white/5">
                    <th className="text-left py-2 px-3 font-medium">{t('date')}</th>
                    <th className="text-right py-2 px-3 font-medium">{t('amount')}</th>
                    <th className="text-right py-2 px-3 font-medium">{t('commission')}</th>
                    <th className="text-right py-2 px-3 font-medium">{t('net')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('status')}</th>
                    <th className="text-left py-2 px-3 font-medium">{t('bank')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payouts.map((p: any) => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2 px-3 text-slate-400 text-xs">{formatDate(p.createTimestamp)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatCurrency(parseFloat(p.amount))}</td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">{p.commission ? formatCurrency(parseFloat(p.commission)) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-400">{p.net ? formatCurrency(parseFloat(p.net)) : '—'}</td>
                      <td className="py-2 px-3"><span className={`badge ${statusClass(p.status)}`}>{statusLabel(p.status, t)}</span></td>
                      <td className="py-2 px-3 text-slate-500 text-xs">{p.bankCode ? `${p.bankCode} ****${p.bankAccountNumber?.slice(-4)}` : '—'}</td>
                    </tr>
                  ))}
                  {data.payouts.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-500">{t('noResults')}</td></tr>}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
