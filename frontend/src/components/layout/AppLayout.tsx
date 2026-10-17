import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Flag, LogOut, User as UserIcon, Trophy, LayoutGrid, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { Avatar } from './Avatar';
import { Button } from '@/components/ui';

const NAV_ITEMS = [
  { to: '/challenges', label: '题目', icon: LayoutGrid, end: false },
  { to: '/scoreboard', label: '榜单', icon: Trophy, end: false },
];

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const navigate = useNavigate();

  const onLogout = () => {
    clear();
    navigate('/auth/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 border-b border-border bg-surface/95 backdrop-blur sticky top-0 z-30">
        <div className="h-full max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 hover:no-underline">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded bg-accent text-accent-fg">
              <Flag className="h-3.5 w-3.5" />
            </span>
            <span className="font-semibold tracking-tight text-fg">CTF-OJ</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1 ml-2">
            {NAV_ITEMS.map((it) => (
              <NavItem key={it.to} {...it} />
            ))}
            {user?.role === 'admin' && (
              <NavItem to="/admin" label="管理" icon={Shield} end={false} />
            )}
          </nav>

          <div className="flex-1" />

          {user ? (
            <div className="flex items-center gap-2">
              <Link
                to={`/users/${user.id}`}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-surface-2 transition-colors"
              >
                <Avatar name={user.username} />
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-xs text-muted">{user.score} pts</span>
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
              <Button variant="primary" size="sm" onClick={() => navigate('/auth/register')}>
                注册
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 bg-bg">
        <Outlet />
      </main>

      <footer className="border-t border-border py-4 text-center text-2xs text-muted">
        CTF-OJ · 一个面向 CTF 练习的在线评测系统
      </footer>
    </div>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  end,
}: {
  to: string;
  label: string;
  icon: typeof Trophy;
  end: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center gap-1.5 h-8 px-2.5 rounded text-sm transition-colors',
          isActive ? 'bg-surface-2 text-fg font-medium' : 'text-muted hover:text-fg hover:bg-surface-2',
        )
      }
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </NavLink>
  );
}
