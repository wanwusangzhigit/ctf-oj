import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
      <div className="font-mono text-5xl text-muted mb-2">404</div>
      <p className="text-sm text-muted mb-6">页面不存在或已被移除。</p>
      <Link
        to="/"
        className="inline-flex items-center h-9 px-4 rounded-md bg-accent text-accent-fg text-sm font-medium hover:bg-accent-hover"
      >
        返回首页
      </Link>
    </div>
  );
}
