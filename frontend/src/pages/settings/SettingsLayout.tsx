import i18n from '@/locales/i18n';
import { NavLink, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { AvatarBlock } from '@/components/layout/AvatarBlock';
import { getUser } from '@/api/user';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/settings', label: i18n.t('资料'), end: true },
  { to: '/settings/password', label: i18n.t('密码') },
  { to: '/settings/security', label: i18n.t('安全') },
];

/**
 * /settings shell — one screen per concern instead of three panels stacked on
 * the public profile page.
 */
export function SettingsLayout() {
  const user = useAuthStore((s) => s.user);
  // The store copy is stale for uploads and profile edits, so the masthead reads
  // the same cached row the settings screens invalidate.
  const profileQ = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () => getUser(user!.id),
    enabled: !!user,
    staleTime: 30_000,
  });
  const profile = profileQ.data ?? user;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ account --configure</p>
        <div className="flex items-center gap-4">
          {profile && <AvatarBlock user={profile} />}
          <div className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
              {i18n.t('账号设置')}
            </h1>
            <p className="mt-1 font-mono text-2xs text-ink-3">{profile?.username}</p>
          </div>
        </div>
      </header>

      <nav aria-label={i18n.t('设置导航')} className="mt-6 border-b border-rule">
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.label}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-9 items-center border-b-2 px-0.5 text-sm transition-colors hover:no-underline',
                  isActive
                    ? 'border-amber font-medium text-ink'
                    : 'border-transparent text-ink-3 hover:text-ink',
                )
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  );
}
