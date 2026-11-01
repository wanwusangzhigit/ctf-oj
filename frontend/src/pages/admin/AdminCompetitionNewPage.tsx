import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { CompetitionForm } from '@/components/admin/CompetitionForm';

/** /admin/competitions/new — global competition managers only. */
export function AdminCompetitionNewPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Link
        to="/admin/competitions"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors hover:no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回赛事列表
      </Link>

      <header className="border-b border-rule pb-3">
        <p className="font-mono text-2xs text-ink-3 mb-1 tabular-nums">
          $ sudo admin --competitions new
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">新建赛事</h2>
        <p className="mt-1 text-sm text-ink-3 max-w-prose">
          创建一场新的比赛。绑定题目可留空，留空时计分覆盖全部公开题目。
        </p>
      </header>

      <CompetitionForm
        mode="create"
        onCancel={() => navigate('/admin/competitions')}
        onCreated={() => navigate('/admin/competitions', { replace: true })}
      />
    </div>
  );
}
