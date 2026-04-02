import { useState } from 'react';
import { api } from '../lib/api';
import { useI18n } from '../i18n';

const PLAN_FEATURES = [
  { key: 'monthly_cc_count', label: 'monthlyCcCount', labelZh: '每月活動數量' },
  { key: 'ai_creator_search_count', label: 'aiCreatorSearch', labelZh: 'AI 創作者搜尋' },
  { key: 'ai_images_ads_generation_count', label: 'aiImagesAds', labelZh: 'AI 圖片廣告生成' },
  { key: 'ai_videos_ads_generation_count', label: 'aiVideosAds', labelZh: 'AI 影片廣告生成' },
  { key: 'ai_social_content_generation_count', label: 'aiSocialContent', labelZh: 'AI 社群內容生成' },
  { key: 'ai_video_best_shot_detection_count', label: 'aiBestShot', labelZh: 'AI 影片精彩片段' },
];

const SUBSCRIPTION_LEVELS = [
  'free',
  'monthly_plan_1',
  'monthly_plan_2',
  'monthly_plan_3',
  'monthly_plan_6',
  'monthly_plan_unlimited',
  'plan_lightweight',
  'plan_standard',
  'plan_advanced',
  'plan_enterprise',
];

export default function CreateAccount() {
  const { t, lang } = useI18n();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    password: 'tellit2024',
    brandName: '',
    storeName: '',
    subscriptionLevel: 'free',
  });
  const [features, setFeatures] = useState<Record<string, number>>({});
  const [expiryDate, setExpiryDate] = useState('');
  const [commissionRate, setCommissionRate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const updateField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateFeature = (key: string, value: string) => {
    const num = parseInt(value);
    setFeatures((prev) => {
      const next = { ...prev };
      if (!value || num <= 0) {
        delete next[key];
      } else {
        next[key] = num;
      }
      return next;
    });
  };

  const limitsJson = Object.keys(features).length > 0 ? JSON.stringify(features, null, 2) : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);
    try {
      const payload: any = { ...form };
      if (Object.keys(features).length > 0) {
        payload.customPlan = {
          limits: features,
          expiryDate: expiryDate || undefined,
          commissionRate: commissionRate ? parseFloat(commissionRate) : undefined,
        };
      }
      await api.accounts.create(payload);
      setResult({ success: true });
      // Reset form
      setForm({
        fullName: '',
        email: '',
        phoneNumber: '',
        password: 'tellit2024',
        brandName: '',
        storeName: '',
        subscriptionLevel: 'free',
      });
      setFeatures({});
      setExpiryDate('');
      setCommissionRate('');
    } catch (err: any) {
      setResult({ error: err.message || 'Failed to create account' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">{t('createAccount')}</h2>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        {/* Basic Info */}
        <div className="bg-navy-900 border border-white/5 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('accountInfo')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('fullName')}</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('emailLabel')}</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('phone')}</label>
              <input
                type="text"
                value={form.phoneNumber}
                onChange={(e) => updateField('phoneNumber', e.target.value)}
                placeholder="+886..."
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('defaultPassword')}</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Brand & Store */}
        <div className="bg-navy-900 border border-white/5 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('brandStore')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('brandNameLabel')}</label>
              <input
                type="text"
                value={form.brandName}
                onChange={(e) => updateField('brandName', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('storeNameLabel')}</label>
              <input
                type="text"
                value={form.storeName}
                onChange={(e) => updateField('storeName', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Subscription Plan */}
        <div className="bg-navy-900 border border-white/5 rounded-xl p-6 mb-6">
          <h3 className="text-lg font-semibold mb-4">{t('subscriptionPlan')}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('plan')}</label>
              <select
                value={form.subscriptionLevel}
                onChange={(e) => updateField('subscriptionLevel', e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              >
                {SUBSCRIPTION_LEVELS.map((level) => (
                  <option key={level} value={level} className="bg-navy-900">
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('planExpiryDate')}</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('commissionRateLabel')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder="0.00 ~ 1.00"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Feature Limits */}
          <h4 className="text-sm font-semibold text-slate-300 mb-3">{t('featureLimits')}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
            {PLAN_FEATURES.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <label className="text-sm text-slate-400 flex-1 min-w-0 truncate" title={f.key}>
                  {lang === 'zh' ? f.labelZh : f.label}
                </label>
                <input
                  type="number"
                  min="0"
                  value={features[f.key] || ''}
                  onChange={(e) => updateFeature(f.key, e.target.value)}
                  placeholder="0"
                  className="w-20 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-sm text-slate-200 text-center focus:outline-none focus:border-blue-500"
                />
              </div>
            ))}
          </div>

          {/* JSON Preview */}
          {limitsJson && (
            <div>
              <label className="block text-sm text-slate-400 mb-1">{t('limitsJsonPreview')}</label>
              <pre className="bg-white/5 border border-white/10 rounded-lg p-3 text-xs text-emerald-400 font-mono overflow-x-auto">
                {limitsJson}
              </pre>
            </div>
          )}
        </div>

        {/* Result Message */}
        {result && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              result.success
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}
          >
            {result.success ? t('accountCreated') : result.error}
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || (!form.email && !form.phoneNumber) || !form.password}
          className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {submitting ? t('creating') : t('createAccountBtn')}
        </button>
      </form>
    </div>
  );
}
