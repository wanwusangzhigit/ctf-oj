import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

/**
 * AuthShell — left aside is a "session transcript" rather than a marketing slab.
 * Right side is the actual form, presented like a single column of a lab notebook.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_minmax(0,540px)] bg-paper">
      <aside className="hidden lg:flex flex-col justify-between bg-paper-2 border-r border-rule p-10 relative overflow-hidden">
        <Link
          to="/"
          className="inline-flex items-center gap-2 hover:no-underline border-b-0"
        >
          <span
            aria-hidden
            className="inline-flex h-7 w-7 items-center justify-center bg-ink text-paper rounded-sm relative"
          >
            <span className="absolute inset-[3px] border border-paper/40 rounded-[1px]" />
            <span className="w-1.5 h-1.5 bg-amber relative" />
          </span>
          <span className="font-mono font-semibold tracking-tight">CTF-OJ</span>
        </Link>

        <div className="relative space-y-6 max-w-md">
          <p className="font-mono text-2xs text-ink-3 tracking-tight">
            $ whoami
          </p>
          <h2 className="text-3xl font-semibold tracking-tightest text-ink leading-[1.1]">
            {t('auth.shell.headline1')}
            <br />
            {t('auth.shell.headline2')}
          </h2>
          <p className="text-sm text-ink-2 max-w-prose">
            {t('auth.shell.pitch')}
          </p>
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-rule">
            <TranscriptStat label={t('auth.shell.statChallenges')} value="∞" />
            <TranscriptStat label={t('auth.shell.statCategories')} value="6+" />
            <TranscriptStat label={t('auth.shell.statRealtime')} value="on" />
          </div>
        </div>

        <p className="text-2xs text-ink-3 font-mono">
          {t('auth.shell.terms')}
        </p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <span
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center bg-ink text-paper rounded-sm relative"
            >
              <span className="absolute inset-[3px] border border-paper/40 rounded-[1px]" />
              <span className="w-2 h-2 bg-amber relative" />
            </span>
            <span className="font-mono font-semibold">CTF-OJ</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-3">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

function TranscriptStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-2xs text-ink-3 font-mono">{label}</div>
      <div className="text-base font-mono tabular-nums text-ink">{value}</div>
    </div>
  );
}
