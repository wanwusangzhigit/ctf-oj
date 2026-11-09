export const LOCALE_KEY = 'ctf-oj.locale';

export type Locale = 'zh' | 'en';

/**
 * Stored preference wins; otherwise follow the browser. A browser that
 * advertises a Chinese locale gets Chinese, everything else gets English.
 */
export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(LOCALE_KEY);
    if (saved === 'zh' || saved === 'en') return saved;
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
  const lang = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
  if (!lang) return 'zh';
  return lang.startsWith('zh') ? 'zh' : 'en';
}
