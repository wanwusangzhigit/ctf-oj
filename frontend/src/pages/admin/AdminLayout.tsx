import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { hasDelegation, hasPermission } from '@/lib/permissions';

export function AdminLayout() {
  const user = useAuthStore((s) => s.user);
  const canManageChallenges = hasPermission(user, 'challenge.manage');
  const canManageCompetitions = hasPermission(user, 'competition.manage');
  const canChallenges = canManageChallenges || hasDelegation(user, 'challenge');
  const canCompetitions =
    canManageCompetitions || hasDelegation(user, 'competition');
  const canAnnouncements = hasPermission(user, 'announcement.manage');
  const canCommunity = hasPermission(user, 'community.manage');
  const canUsers = hasPermission(user, 'user.manage');
  const canSettings = hasPermission(user, 'settings.manage');
  const canAudit = hasPermission(user, 'audit.view');
  const canOverview = hasPermission(user, 'admin.overview');
  const canServer = hasPermission(user, 'server.manage');
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">
          $ sudo admin --panel
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          管理后台
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">
          站点运营 —— 按角色展示可用模块。
        </p>
      </header>

      <nav
        role="tablist"
        aria-label="管理"
        className="flex items-center gap-1 mb-8 border-b border-rule-strong overflow-x-auto"
      >
        {canOverview && <Tab to="/admin/overview">概览</Tab>}
        {canManageChallenges && <Tab to="/admin/categories">分类</Tab>}
        {canChallenges && <Tab to="/admin/challenges">题目</Tab>}
        {canManageChallenges && <Tab to="/admin/access-groups">权限组</Tab>}
        {canAnnouncements && <Tab to="/admin/announcements">公告</Tab>}
        {canCommunity && <Tab to="/admin/community">社区</Tab>}
        {canUsers && <Tab to="/admin/users">用户</Tab>}
        {canCompetitions && <Tab to="/admin/competitions">赛事</Tab>}
        {canSettings && <Tab to="/admin/settings">站点</Tab>}
        {canAudit && <Tab to="/admin/audit">审计</Tab>}
        {canServer && <Tab to="/admin/server">服务器</Tab>}
      </nav>

      <Outlet />
    </div>
  );
}

/**
 * Tabs use an amber underline on the active item — quieter than a fill,
 * and visually distinct from the page's hairline-rule header above.
 */
function Tab({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'inline-flex shrink-0 items-center h-9 px-3 -mb-px border-b-2 text-sm whitespace-nowrap transition-colors',
          isActive
            ? 'border-amber text-ink font-medium'
            : 'border-transparent text-ink-3 hover:text-ink',
        )
      }
    >
      {children}
    </NavLink>
  );
}
