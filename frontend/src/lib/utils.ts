import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import i18n from '@/locales/i18n';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

function intlLocale(): string {
  return i18n.language === 'en' ? 'en-US' : 'zh-CN';
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(intlLocale()).format(n);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatTime(value: string | number | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(intlLocale(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function relativeTime(value: string | number | Date): string {
  const d = new Date(value).getTime();
  if (Number.isNaN(d)) return '';
  const diff = d - Date.now();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;

  const rtf = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' });
  if (abs < minute) return rtf.format(Math.round(diff / 1000), 'second');
  if (abs < hour) return rtf.format(Math.round(diff / minute), 'minute');
  if (abs < day) return rtf.format(Math.round(diff / hour), 'hour');
  if (abs < week) return rtf.format(Math.round(diff / day), 'day');
  if (abs < month) return rtf.format(Math.round(diff / week), 'week');
  return rtf.format(Math.round(diff / month), 'month');
}

export function formatDuration(ms: number): string {
  const s = i18n.t('units.second');
  const m = i18n.t('units.minute');
  const h = i18n.t('units.hour');
  if (ms <= 0) return `0 ${s}`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} ${s}`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} ${m} ${sec % 60} ${s}`;
  const hr = Math.floor(min / 60);
  return `${hr} ${h} ${min % 60} ${m}`;
}
