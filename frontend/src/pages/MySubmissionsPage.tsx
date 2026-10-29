import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { mySubmissions } from '@/api/user';
import { formatTime } from '@/lib/utils';

/**
 * MySubmissionsPage — terminal-log style listing of every flag attempt
 * the user has made. Useful for self-auditing solver strategies and
 * for spotting typos that nearly worked.
 */
export function MySubmissionsPage() {
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const q = useQuery({
    queryKey: ['my-submissions', page],
    queryFn: () => mySubmissions(page, pageSize),
    staleTime: 30_000,
  });

  const data = q.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">
          $ history --submissions
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          我的提交
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">
          全部 flag 尝试记录 —— 包括正确与错误，按时间倒序排列。
        </p>
      </header>

      {q.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : q.isError ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          无法加载提交记录，请稍后重试。
        </div>
      ) : (data?.items?.length ?? 0) === 0 ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          还没有提交记录 —— 去题目页面试着提交一个 flag。
        </div>
      ) : (
        <div className="border-t border-ink">
          <ul>
            {data!.items.map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-[auto_1fr_auto] gap-x-4 items-baseline py-3 border-b border-rule"
              >
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-sm self-center ${
                    s.isCorrect ? 'bg-amber-soft text-amber' : 'bg-paper-2 text-ink-3'
                  }`}
                >
                  {s.isCorrect ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <XCircle className="h-3 w-3" />
                  )}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.challenge?.title ?? `题目 #${s.challengeId}`}
                  </div>
                  <div className="font-mono text-2xs text-ink-3 mt-0.5 truncate">
                    {s.flag}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-2xs text-ink-3 tabular-nums">
                    {formatTime(s.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </div>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-4 text-2xs font-mono text-ink-3">
      <span>
        page {page} / {totalPages}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="px-2 py-1 border border-rule rounded-sm hover:border-rule-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← prev
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          className="px-2 py-1 border border-rule rounded-sm hover:border-rule-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          next →
        </button>
      </div>
    </div>
  );
}
