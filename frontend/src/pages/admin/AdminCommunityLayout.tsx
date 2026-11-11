import i18n from '@/locales/i18n';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/admin/community', label: i18n.t('策略与授权'), end: true },
  { to: '/admin/community/sections', label: i18n.t('板块') },
];

/**
 * /admin/community shell — station-wide policy on one screen, the boards
 * themselves on the other.
 */
export function AdminCommunityLayout() {
  return (
    <div className="space-y-8">
      <header className="border-t-2 border-ink pt-6">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ sudo admin --community</p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{i18n.t('社区')}</h2>
        <p className="mt-1 text-sm text-ink-3 max-w-prose">{i18n.t('全站可见范围、发帖策略与访问授权在一处；板块的新增、排序、单独策略与板块管理授权在另一处。 社区文案的编辑入口位于「站点设置 › 社区文案」。')}</p>
      </header>

      <nav aria-label={i18n.t('社区管理分页')} className="border-b border-rule">
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

      <Outlet />
    </div>
  );
}
