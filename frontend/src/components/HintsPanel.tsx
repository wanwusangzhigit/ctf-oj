import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { Button, Spinner, useToast } from '@/components/ui';
import { cn } from '@/lib/utils';
import { listHints, unlockHint } from '@/api/hint';
import { ApiClientError } from '@/api/client';
import { Markdown } from '@/components/Markdown';
import type { HintView } from '@/types';

/**
 * HintsPanel — public view of a challenge's hint list.
 *
 * Locked hints show only their cost ratio and a "unlock" affordance.
 * Unlocked hints reveal their content inline via Markdown.
 *
 * Cost model reminder: each unlocked hint reduces the eventual solve
 * score by its costRatio (0.0–1.0). The reduction is computed at solve
 * time on the backend — the frontend just shows the cost transparently.
 */
export function HintsPanel({
  challengeId,
  competitionId,
}: {
  challengeId: number;
  competitionId?: number;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const [unlockingId, setUnlockingId] = useState<number | null>(null);

  const hintsQ = useQuery({
    queryKey: ['challenge-hints', challengeId, competitionId ?? 0],
    queryFn: () => listHints(challengeId, competitionId),
    staleTime: 30_000,
  });

  const unlockMut = useMutation({
    mutationFn: (hintId: number) => unlockHint(challengeId, hintId, competitionId),
    onSuccess: () => {
      toast.success('已解锁');
      qc.invalidateQueries({
        queryKey: ['challenge-hints', challengeId, competitionId ?? 0],
      });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '解锁失败'),
  });

  if (hintsQ.isLoading) {
    return (
      <div className="border-t border-rule py-4 flex items-center gap-2 text-2xs font-mono text-ink-3">
        <Spinner className="h-3 w-3" /> loading hints…
      </div>
    );
  }
  const hints = hintsQ.data ?? [];
  if (hints.length === 0) return null;

  return (
    <div className="border-t border-rule pt-4 mt-6">
      <SectionLabel>提示（解锁会扣减本题奖励分）</SectionLabel>
      <ul className="space-y-2">
        {hints.map((h, idx) => (
          <li key={h.id} className="border border-rule rounded-sm">
            <HintRow
              index={idx + 1}
              hint={h}
              unlocking={unlockingId === h.id}
              onUnlock={() => {
                setUnlockingId(h.id);
                unlockMut.mutate(h.id, {
                  onSettled: () => setUnlockingId(null),
                });
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function HintRow({
  index,
  hint,
  unlocking,
  onUnlock,
}: {
  index: number;
  hint: HintView;
  unlocking: boolean;
  onUnlock: () => void;
}) {
  const cost = Math.round(hint.costRatio * 100);

  if (hint.unlocked) {
    return (
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-2xs text-ink-3 tabular-nums">
            hint #{String(index).padStart(2, '0')} · 已解锁
          </span>
          <span
            className={cn(
              'font-mono text-2xs tabular-nums',
              cost > 0 ? 'text-amber' : 'text-ink-3',
            )}
          >
            {cost > 0 ? `-${cost}%` : 'free'}
          </span>
        </div>
        <div className="text-sm text-ink-2 max-w-prose">
          <Markdown>{hint.content || '（空内容）'}</Markdown>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-paper-2 text-ink-3 shrink-0">
          <Lock className="h-3 w-3" />
        </span>
        <div className="min-w-0">
          <div className="font-mono text-2xs text-ink-3 tabular-nums">
            hint #{String(index).padStart(2, '0')}
          </div>
          <div className="text-2xs text-ink-3 mt-0.5">
            {cost > 0
              ? `解锁后该题奖励分将减少 ${cost}%`
              : '免费解锁'}
          </div>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        loading={unlocking}
        onClick={onUnlock}
      >
        解锁
        {cost > 0 && (
          <span className="ml-1 text-2xs text-amber font-mono tabular-nums">
            -{cost}%
          </span>
        )}
      </Button>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-rule pb-2 mb-3">
      <h2 className="text-sm font-medium text-ink">{children}</h2>
    </div>
  );
}
