import { create } from 'zustand';
import i18n from '@/locales/i18n';
import { LOCALE_KEY, type Locale } from '@/locales/detect';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: i18n.language === 'en' ? 'en' : 'zh',
  setLocale: (locale) => {
    try {
      localStorage.setItem(LOCALE_KEY, locale);
    } catch {
      // Storage can be unavailable in private browsing modes.
    }
    void i18n.changeLanguage(locale);
    set({ locale });
  },
}));
