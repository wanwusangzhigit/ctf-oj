import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Flag } from 'lucide-react';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between bg-surface-2 border-r border-border p-10">
        <Link to="/" className="inline-flex items-center gap-2 hover:no-underline">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-fg">
            <Flag className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">CTF-OJ</span>
        </Link>
        <div className="space-y-3">
          <h2 className="text-2xl font-semibold tracking-tight text-fg">
            面向 CTF 练习的在线评测平台。
          </h2>
          <p className="text-sm text-muted max-w-md">
            多分类题目、动态打分、解题排行。专注训练本身，界面简洁，操作直接。
          </p>
        </div>
        <p className="text-2xs text-muted">使用即代表同意服务条款与隐私政策。</p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-fg">
              <Flag className="h-4 w-4" />
            </span>
            <span className="font-semibold">CTF-OJ</span>
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-fg">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}
