import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import zh from './zh';
import { detectLocale } from './detect';

void i18n.use(initReactI18next).init({
  resources: { en, zh },
  lng: detectLocale(),
  fallbackLng: 'zh',
  ns: Object.keys(en),
  defaultNS: 'common',
  // React escapes text on its own; leaving i18next escaping on would double-escape.
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
  parseMissingKeyHandler: (key) => {
    console.warn('[i18n] missing translation key:', key);
  },
});

export default i18n;
