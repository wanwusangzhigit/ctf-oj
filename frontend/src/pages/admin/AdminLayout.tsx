import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';

export function AdminLayout() {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">管理后台</h1>
        <p className="text-sm text-muted mt-1">仅管理员可见。</p>
      </header>

      <nav className="flex items-center gap-1 mb-6 border-b border-border">
        <Tab to="/admin/categories">分类</Tab>
        <Tab to="/admin/challenges">题目</Tab>
      </nav>

      <Outlet />
    </div>
  );
}

function Tab({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center h-9 px-3 -mb-px border-b-2 text-sm transition-colors',
          isActive
            ? 'border-accent text-fg font-medium'
            : 'border-transparent text-muted hover:text-fg',
        )
      }
    >
      {children}
    </NavLink>
  );
}
