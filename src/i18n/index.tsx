import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import en, { type Translations } from './en';
import zh from './zh';

type Lang = 'en' | 'zh';

const translations: Record<Lang, Translations> = { en, zh };

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: keyof Translations, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>(null!);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem('dashboard-lang');
    return (saved === 'zh' ? 'zh' : 'en') as Lang;
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem('dashboard-lang', l);
  }, []);

  const t = useCallback(
    (key: keyof Translations, params?: Record<string, string | number>) => {
      let str = translations[lang][key] || translations.en[key] || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          str = str.replace(`{${k}}`, String(v));
        });
      }
      return str;
    },
    [lang],
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
