import { NavLink } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { Translations } from '../i18n/en';

const navItems: { to: string; labelKey: keyof Translations; icon: React.FC }[] = [
  { to: '/', labelKey: 'navOverview', icon: OverviewIcon },
  { to: '/revenue', labelKey: 'navRevenue', icon: RevenueIcon },
  { to: '/brands', labelKey: 'navBrands', icon: BrandsIcon },
  { to: '/creators', labelKey: 'navCreatorPayments', icon: CreatorsIcon },
];

export default function Sidebar() {
  const { lang, setLang, t } = useI18n();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-navy-900 border-r border-white/5 flex flex-col z-50">
      <div className="px-5 py-6 border-b border-white/5">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-blue-400">Tellit</span> {t('dashboard')}
        </h1>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ to, labelKey, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`
            }
          >
            <Icon />
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-white/5 space-y-3">
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
          <button
            onClick={() => setLang('en')}
            className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              lang === 'en' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            EN
          </button>
          <button
            onClick={() => setLang('zh')}
            className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
              lang === 'zh' ? 'bg-blue-500/20 text-blue-400' : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            中文
          </button>
        </div>
        <div className="text-xs text-slate-500">{t('internalTool')}</div>
      </div>
    </aside>
  );
}

function OverviewIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  );
}

function RevenueIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function BrandsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
    </svg>
  );
}

function CreatorsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  );
}
