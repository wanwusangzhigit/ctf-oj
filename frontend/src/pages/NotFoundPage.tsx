import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-24">
      <div className="border-t-2 border-ink pt-6">
        <p className="font-mono text-2xs text-ink-3 mb-3">
          $ cat /404
        </p>
        <div className="font-mono text-6xl text-ink tracking-tightest tabular-nums">
          404
        </div>
        <h1 className="mt-4 text-xl font-semibold tracking-tight">
          页面不存在或已被移除
        </h1>
        <p className="mt-2 text-ink-3 max-w-prose">
          可能是链接过期、地址输错，或它从来没存在过。
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center h-9 px-4 bg-ink text-paper rounded-sm text-sm font-medium hover:bg-ink-2 transition-colors hover:no-underline"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
