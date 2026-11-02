import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lightbulb, Plus, Save, Trash2 } from 'lucide-react';
import { Button, Input, Spinner, Textarea, useConfirm, useToast } from '@/components/ui';
import {
  adminCreateHint,
  adminDeleteHint,
  adminListHints,
  adminUpdateHint,
  type HintInput,
} from '@/api/hint';
import { ApiClientError } from '@/api/client';
import type { Hint } from '@/types';

/**
 * HintManager — admin CRUD for a challenge's hints.
 *
 * Each hint carries a cost_ratio (0–1). When a user unlocks it and later
 * solves the challenge, the awarded score is reduced by the sum of the
 * unlocked ratios. Editors are inline so the list stays dense.
 */
export function HintManager({ challengeId }: { challengeId: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const listQ = useQuery({
    queryKey: ['admin-hints', challengeId],
    queryFn: () => adminListHints(challengeId),
    staleTime: 15_000,
  });

  const [adding, setAdding] = useState(false);

  const createMut = useMutation({
    mutationFn: (input: HintInput) => adminCreateHint(challengeId, input),
    onSuccess: () => {
      toast.success('提示已添加');
      setAdding(false);
      qc.invalidateQueries({ queryKey: ['admin-hints', challengeId] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '添加失败'),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, input }: { id: number; input: HintInput }) =>
      adminUpdateHint(id, input),
    onSuccess: () => {
      toast.success('已保存');
      qc.invalidateQueries({ queryKey: ['admin-hints', challengeId] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '保存失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => adminDeleteHint(id),
    onSuccess: () => {
      toast.success('已删除');
      qc.invalidateQueries({ queryKey: ['admin-hints', challengeId] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '删除失败'),
  });

  const hints = listQ.data ?? [];
  const nextOrder = hints.reduce((m, h) => Math.max(m, h.sortOrder), 0) + 1;

  return (
    <div className="border border-rule bg-paper-2 p-4 space-y-3 rounded-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium inline-flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5 text-amber" />
          提示
        </span>
        {!adding && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setAdding(true)}
          >
            <Plus className="h-3 w-3" />
            添加提示
          </Button>
        )}
      </div>

      <p className="text-2xs text-ink-3 leading-relaxed">
        每个提示设置扣分比例（0–1）。用户解锁提示后，解题得分按所有已解锁提示的比例之和扣减。
      </p>

      {listQ.isLoading ? (
        <div className="py-6 flex items-center justify-center">
          <Spinner className="h-4 w-4 text-ink-3" />
        </div>
      ) : hints.length === 0 && !adding ? (
        <p className="text-2xs text-ink-3">暂无提示。</p>
      ) : (
        <ul className="space-y-2">
          {hints.map((h, idx) => (
            <li key={h.id}>
              <HintEditor
                index={idx + 1}
                hint={h}
                saving={updateMut.isPending}
                deleting={deleteMut.isPending}
                onSave={(input) => updateMut.mutate({ id: h.id, input })}
                onDelete={async () => {
                  const ok = await confirm({
                    title: '删除提示',
                    description: `第 ${idx + 1} 条提示将被删除，无法恢复。`,
                    confirmText: '删除',
                  });
                  if (ok) deleteMut.mutate(h.id);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <HintEditor
          index={nextOrder}
          saving={createMut.isPending}
          onCancel={() => setAdding(false)}
          onSave={(input) => createMut.mutate(input)}
        />
      )}
    </div>
  );
}

function HintEditor({
  index,
  hint,
  saving,
  deleting,
  onSave,
  onDelete,
  onCancel,
}: {
  index: number;
  hint?: Hint;
  saving: boolean;
  deleting?: boolean;
  onSave: (input: HintInput) => void;
  onDelete?: () => void;
  onCancel?: () => void;
}) {
  const [costPct, setCostPct] = useState(
    hint ? Math.round(hint.costRatio * 100) : 20,
  );
  const [content, setContent] = useState(hint?.content ?? '');

  const dirty =
    !hint ||
    content !== hint.content ||
    Math.round(hint.costRatio * 100) !== costPct;

  return (
    <div className="border border-rule rounded-sm bg-paper p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-mono text-2xs text-ink-3 tabular-nums">
          hint #{String(index).padStart(2, '0')}
        </span>
        <div className="flex-1" />
        <label className="inline-flex items-center gap-1 text-2xs text-ink-3">
          扣分
          <Input
            type="number"
            min={0}
            max={100}
            value={costPct}
            onChange={(e) =>
              setCostPct(Math.max(0, Math.min(100, Number(e.target.value) || 0)))
            }
            className="h-7 w-16 text-2xs font-mono tabular-nums"
          />
          %
        </label>
      </div>
      <Textarea
        rows={2}
        value={content}
        placeholder="提示内容（支持 Markdown）"
        onChange={(e) => setContent(e.target.value)}
        className="text-2xs"
      />
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            取消
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            loading={deleting}
            onClick={onDelete}
            aria-label="删除提示"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={saving}
          disabled={!content.trim() || !dirty}
          onClick={() =>
            onSave({ sortOrder: hint?.sortOrder ?? index, costRatio: costPct / 100, content })
          }
        >
          <Save className="h-3 w-3" />
          {hint ? '保存' : '添加'}
        </Button>
      </div>
    </div>
  );
}
