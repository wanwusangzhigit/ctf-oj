import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LogOut, Menu, User as UserIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { logout as apiLogout } from '@/api/auth';
import { useSiteStore } from '@/stores/site';
import { Avatar } from './Avatar';
import { NotificationBell } from './NotificationBell';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { Button } from '@/components/ui';
import { canAccessAdmin } from '@/lib/permissions';

/**
 * App nav — text-only, sentence-case. Icons are removed from the nav itself
 * so the words carry the meaning (and we avoid the lucide-everywhere look);
 * the only graphic element in the header is the square brand mark.
 */
const NAV_ITEMS: { to: string; label: string; end?: boolean }[] = [
  { to: '/challenges',   label: '题目' },
  { to: '/competitions', label: '赛事' },
  { to: '/scoreboard',   label: '榜单' },
  { to: '/search',       label: '搜索' },
  { to: '/community',    label: '社区' },
  { to: '/teams',        label: '团队' },
  { to: '/stats',        label: '统计' },
  { to: '/instances',    label: '实例' },
  { to: '/announcements', label: '公告' },
];

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const siteName = useSiteStore((s) => s.settings?.siteName ?? 'CTF-OJ');
  useNotificationSocket();
  const registrationOpen = useSiteStore((s) => s.settings?.registrationOpen ?? true);

  // Keep document.title in sync with the site name.
  useEffect(() => {
    document.title = siteName;
  }, [siteName]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const onLogout = async () => {
    try {
      await apiLogout();
    } finally {
      clear();
      navigate('/auth/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-paper text-ink">
      <header className="border-b border-rule sticky top-0 z-30 bg-paper/95 backdrop-blur">
        <div className="h-14 max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2 hover:no-underline border-b-0"
            aria-label="CTF-OJ home"
          >
            <BrandMark />
            <span className="font-mono font-semibold tracking-tight text-ink">
              {siteName}
            </span>
            <span className="hidden sm:inline text-2xs text-ink-3 font-mono ml-1">
              v0.1
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-0 ml-4 -ml-1">
            {NAV_ITEMS.map((it) => (
              <NavItem key={it.to} {...it} />
            ))}
            {canAccessAdmin(user) && <NavItem to="/admin" label="管理" />}
          </nav>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            className="sm:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? '关闭菜单' : '打开菜单'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          {user ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Link
                to={`/users/${user.id}`}
                className="flex items-center gap-2 px-1.5 py-1 rounded-sm hover:bg-paper-2 transition-colors hover:no-underline border-b-0"
              >
                <Avatar name={user.username} />
                <div className="hidden sm:flex flex-col items-end leading-tight">
                  <span className="text-2xs text-ink-3 font-mono tabular-nums">
                    {user.score} pts
                  </span>
                  <span className="text-sm font-medium">{user.username}</span>
                </div>
              </Link>
              <Button variant="ghost" size="icon" onClick={onLogout} aria-label="退出">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/auth/login')}>
                <UserIcon className="h-3.5 w-3.5" />
                登录
              </Button>
              {registrationOpen && (
                <Button variant="primary" size="sm" onClick={() => navigate('/auth/register')}>
                  注册
                </Button>
              )}
            </div>
          )}
        </div>
        {menuOpen && (
          <nav className="sm:hidden border-t border-rule bg-paper px-4 py-2 flex flex-col items-start">
            {NAV_ITEMS.map((it) => (
              <NavItem key={it.to} {...it} />
            ))}
            {canAccessAdmin(user) && <NavItem to="/admin" label="管理" />}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="border-t border-rule">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4 text-2xs text-ink-3 font-mono">
          <span>{siteName} — 面向 CTF 练习的在线评测平台</span>
          <span className="hidden sm:inline">capture · submit · repeat</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * Square brand mark — the only graphic identifier in the chrome.
 * Built from plain elements so it scales crisply and respects foreground color.
 */
function BrandMark() {
  return (
    <span
      aria-hidden
      className="inline-flex h-6 w-6 items-center justify-center bg-ink text-paper rounded-sm relative"
    >
      <span className="absolute inset-[3px] border border-paper/40 rounded-[1px]" />
      <span className="w-1.5 h-1.5 bg-amber relative" />
    </span>
  );
}

function NavItem({
  to,
  label,
  end,
}: {
  to: string;
  label: string;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center h-8 px-2.5 text-sm transition-colors',
          isActive
            ? 'text-ink font-medium'
            : 'text-ink-3 hover:text-ink',
        )
      }
    >
      {label}
    </NavLink>
  );
}
