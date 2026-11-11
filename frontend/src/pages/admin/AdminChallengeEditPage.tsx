import i18n from '@/locales/i18n';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ChallengeForm } from '@/components/admin/ChallengeForm';
import { Spinner } from '@/components/ui';

/**
 * /admin/challenges/:id/edit — edit an existing challenge.
 *
 * Wraps ChallengeForm (mode='edit'); adds a back-link to the list.
 * Renders a quiet loader while the challenge is being fetched so the
 * form doesn't flash its EMPTY defaults.
 */
export function AdminChallengeEditPage() {
  const { id } = useParams<{ id: string }>();
  const cid = Number(id);

  if (!Number.isFinite(cid) || cid <= 0) {
    return (
      <div className="border-t border-rule pt-6">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          {i18n.t('题目 ID 无效')}
        </h2>
        <p className="text-sm text-ink-3 mt-2">{i18n.t('URL 中的 id 参数不是合法的数字。')}</p>
        <Link
          to="/admin/challenges"
          className="mt-4 inline-flex items-center gap-1 text-amber font-medium text-sm"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {i18n.t('返回题目列表')}
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/admin/challenges"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors mb-6 hover:no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {i18n.t('返回题目列表')}
      </Link>

      <ChallengeForm
        mode="edit"
        challengeId={cid}
        onSaved={() => {
          /* stay on page; toast handled inside form */
        }}
      />
    </div>
  );
}

/** Re-exported so Suspense fallbacks have something to render. */
export function EditLoading() {
  return (
    <div className="py-12 flex items-center justify-center">
      <Spinner className="h-5 w-5 text-ink-3" />
    </div>
  );
}
