import i18n from '@/locales/i18n';
import { NavLink, Outlet } from 'react-router-dom';
import { Spinner } from '@/components/ui';
import { useAdminSettings } from '@/hooks/useAdminSettings';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/admin/settings', label: i18n.t('品牌'), end: true },
  { to: '/admin/settings/registration', label: i18n.t('注册与认证') },
  { to: '/admin/settings/misc', label: i18n.t('其他设置') },
  { to: '/admin/settings/copy', label: i18n.t('社区文案') },
  { to: '/admin/settings/broadcast', label: i18n.t('邮件群发') },
];

/**
 * /admin/settings shell — one screen per concern instead of one long form that
 * saves every key on any edit.
 */
export function AdminSettingsLayout() {
  const { query } = useAdminSettings();

  return (
    <div className="space-y-8">
      <header className="border-t-2 border-ink pt-6">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ sudo admin --settings</p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{i18n.t('站点设置')}</h2>
        <p className="mt-1 text-sm text-ink-3 max-w-prose">
          {i18n.t('所有运行时可配置项 —— 不需要重启服务即可生效。每个分页只保存自己负责的键。')}
        </p>
      </header>

      <nav aria-label={i18n.t('站点设置分页')} className="border-b border-rule">
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

      {query.isError ? (
        <p className="text-sm text-ink-3">{i18n.t('读取站点设置失败，请刷新重试。')}</p>
      ) : query.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : (
        <Outlet />
      )}
    </div>
  );
}
