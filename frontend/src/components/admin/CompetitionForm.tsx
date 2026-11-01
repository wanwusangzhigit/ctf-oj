import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Field,
  Input,
  Textarea,
  useToast,
} from '@/components/ui';
import { AccessGrantEditor } from '@/components/admin/ChallengeAccessEditor';
import {
  createCompetition,
  getCompetition,
  updateCompetition,
} from '@/api/competition';
import { listChallenges } from '@/api/challenge';
import { ApiClientError } from '@/api/client';
import { useSiteStore } from '@/stores/site';
import { useAuthStore } from '@/stores/auth';
import { hasPermission } from '@/lib/permissions';
import type {
  AccessSubject,
  ChallengeStatus,
  Competition,
  CompetitionInput,
} from '@/types';

export const CHALLENGE_STATUS: Record<ChallengeStatus, string> = {
  draft: '草稿',
  hidden: '隐藏',
  published: '已发布',
  archived: '归档',
};

const SELECT_CLS =
  'h-9 px-2 w-full bg-paper border border-rule rounded-sm text-sm focus:outline-none focus:border-amber transition-colors';

const EMPTY: CompetitionInput = {
  name: '',
  slug: '',
  description: '',
  startAt: '',
  endAt: '',
  freezeAt: '',
  isActive: false,
  registrationCode: '',
  registrationRequired: false,
  visibility: 'public',
  scoringMode: 'dynamic',
  challengeIds: [],
  archived: false,
};

function inputFrom(c: Competition): CompetitionInput {
  return {
    name: c.name,
    slug: c.slug,
    description: c.description ?? '',
    startAt: c.startAt ?? '',
    endAt: c.endAt ?? '',
    freezeAt: c.freezeAt ?? '',
    isActive: c.isActive,
    registrationCode: c.registrationCode ?? '',
    registrationRequired: c.registrationRequired,
    visibility: c.visibility ?? 'public',
    scoringMode: c.scoringMode ?? 'dynamic',
    challengeIds: c.challenges?.map((ch) => ch.id) ?? [],
    archived: !!c.archivedAt,
  };
}

/**
 * Competition metadata form shared by `/admin/competitions/new` and
 * `/admin/competitions/:id/edit`.
 *
 * `competition` is the row from the shared admin list query; the caller renders
 * the loading / not-found states so this component only deals with a known row.
 * The detail request exists only to hydrate grants, so it runs for global
 * managers — delegates see no grant editor and must not write `accessGrants`.
 */
export function CompetitionForm({
  mode,
  competition,
  onCancel,
  onCreated,
  onSaved,
}: {
  mode: 'create' | 'edit';
  competition?: Competition;
  onCancel: () => void;
  onCreated?: (id: number) => void;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const reloadSite = useSiteStore((s) => s.load);
  const user = useAuthStore((s) => s.user);
  const canManageAll = hasPermission(user, 'competition.manage');
  const isEdit = mode === 'edit';

  const [form, setForm] = useState<CompetitionInput>(EMPTY);
  const [grants, setGrants] = useState<AccessSubject[]>([]);
  const [challengeQuery, setChallengeQuery] = useState('');

  useEffect(() => {
    if (!competition) return;
    setForm(inputFrom(competition));
    setGrants(competition.accessGrants ?? []);
  }, [competition]);

  const detailQ = useQuery({
    queryKey: ['admin-competition', competition?.id],
    queryFn: () => getCompetition(competition!.id, 'admin'),
    enabled: isEdit && canManageAll && !!competition,
    staleTime: 0,
  });

  useEffect(() => {
    const detail = detailQ.data;
    if (!detail) return;
    const next = detail.accessGrants ?? [];
    setGrants(next);
    setForm((f) => ({ ...f, accessGrants: next }));
  }, [detailQ.data]);

  const challengesQ = useQuery({
    queryKey: ['admin-challenges', 'for-competition'],
    queryFn: () => listChallenges({ scope: 'admin', pageSize: 100 }),
    staleTime: 60_000,
  });

  function patch(next: Partial<CompetitionInput>) {
    setForm((f) => ({ ...f, ...next }));
  }

  const saveMut = useMutation({
    mutationFn: (input: CompetitionInput) =>
      isEdit && competition
        ? updateCompetition(competition.id, input)
        : createCompetition(input),
    onSuccess: (saved) => {
      toast.success(isEdit ? '已保存' : '已创建');
      qc.invalidateQueries({ queryKey: ['admin-competitions'] });
      qc.invalidateQueries({ queryKey: ['admin-competition', saved.id] });
      reloadSite();
      if (isEdit) onSaved?.();
      else onCreated?.(saved.id);
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '保存失败'),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    saveMut.mutate({
      ...form,
      startAt: form.startAt || undefined,
      endAt: form.endAt || undefined,
      freezeAt: form.freezeAt || undefined,
      registrationCode: form.registrationCode || undefined,
      accessGrants: canManageAll ? grants : undefined,
    });
  }

  const boundIds = form.challengeIds ?? [];
  const filteredChallenges = (challengesQ.data?.items ?? []).filter((ch) => {
    const q = challengeQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      ch.title.toLowerCase().includes(q) ||
      String(ch.id) === q ||
      `#${ch.id}` === q
    );
  });

  return (
    <form
      onSubmit={submit}
      className="max-w-3xl space-y-4 border border-rule bg-paper-2/40 p-5"
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="名称" htmlFor="comp-name">
          <Input
            id="comp-name"
            required
            value={form.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Field>
        <Field label="slug" htmlFor="comp-slug" hint="用于 URL">
          <Input
            id="comp-slug"
            required
            value={form.slug}
            onChange={(e) => patch({ slug: e.target.value })}
          />
        </Field>
      </div>

      <Field label="描述" htmlFor="comp-desc">
        <Textarea
          id="comp-desc"
          rows={3}
          value={form.description}
          onChange={(e) => patch({ description: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-3 gap-3">
        <Field label="开始时间" htmlFor="comp-start">
          <Input
            id="comp-start"
            type="datetime-local"
            value={form.startAt?.slice(0, 16) ?? ''}
            onChange={(e) =>
              patch({
                startAt: e.target.value ? new Date(e.target.value).toISOString() : '',
              })
            }
          />
        </Field>
        <Field label="结束时间" htmlFor="comp-end">
          <Input
            id="comp-end"
            type="datetime-local"
            value={form.endAt?.slice(0, 16) ?? ''}
            onChange={(e) =>
              patch({
                endAt: e.target.value ? new Date(e.target.value).toISOString() : '',
              })
            }
          />
        </Field>
        <Field label="冻结时间" htmlFor="comp-freeze" hint="可选">
          <Input
            id="comp-freeze"
            type="datetime-local"
            value={form.freezeAt?.slice(0, 16) ?? ''}
            onChange={(e) =>
              patch({
                freezeAt: e.target.value ? new Date(e.target.value).toISOString() : '',
              })
            }
          />
        </Field>
      </div>

      <Field
        label="报名邀请码"
        htmlFor="comp-reg-code"
        hint="可选 —— 设置后报名需要此码"
      >
        <Input
          id="comp-reg-code"
          value={form.registrationCode ?? ''}
          onChange={(e) => patch({ registrationCode: e.target.value })}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="可见性" htmlFor="comp-visibility">
          <select
            id="comp-visibility"
            className={SELECT_CLS}
            value={form.visibility ?? 'public'}
            onChange={(e) =>
              patch({ visibility: e.target.value as 'public' | 'private' })
            }
          >
            <option value="public">公开</option>
            <option value="private">私有（仅管理员可见）</option>
          </select>
        </Field>
        <Field
          label="计分模式"
          htmlFor="comp-scoring"
          hint="固定=原始分；三血=前三解有加成"
        >
          <select
            id="comp-scoring"
            className={SELECT_CLS}
            value={form.scoringMode ?? 'dynamic'}
            onChange={(e) =>
              patch({ scoringMode: e.target.value as CompetitionInput['scoringMode'] })
            }
          >
            <option value="dynamic">动态分值</option>
            <option value="fixed">固定分值</option>
            <option value="three_blood">三血加成</option>
          </select>
        </Field>
        <Field
          label="报名"
          htmlFor="comp-reg-required"
          hint="开启后未报名不能提交赛事题或参与答疑"
        >
          <label className="flex items-center gap-2 h-9 text-sm">
            <input
              id="comp-reg-required"
              type="checkbox"
              checked={form.registrationRequired ?? false}
              onChange={(e) => patch({ registrationRequired: e.target.checked })}
            />
            必须报名
          </label>
        </Field>
        {canManageAll && (
          <Field label="归档" htmlFor="comp-archived" hint="归档后从公开列表隐藏">
            <label className="flex items-center gap-2 h-9 text-sm">
              <input
                id="comp-archived"
                type="checkbox"
                checked={form.archived ?? false}
                onChange={(e) => patch({ archived: e.target.checked })}
              />
              已归档
            </label>
          </Field>
        )}
      </div>

      <Field
        label={`绑定题目（已选 ${boundIds.length}）`}
        hint="不选则计入全部题目；隐藏题目需在题目编辑页单独授权"
      >
        <div className="mb-2 flex items-center gap-2">
          <Input
            value={challengeQuery}
            onChange={(e) => setChallengeQuery(e.target.value)}
            placeholder="按标题或 ID 筛选"
            aria-label="筛选题目"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => patch({ challengeIds: [] })}
          >
            清空
          </Button>
        </div>
        <div className="max-h-56 overflow-auto border border-rule rounded-sm p-2 space-y-1">
          {filteredChallenges.map((ch) => (
            <label key={ch.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={boundIds.includes(ch.id)}
                onChange={(e) => {
                  const ids = new Set(boundIds);
                  if (e.target.checked) ids.add(ch.id);
                  else ids.delete(ch.id);
                  patch({ challengeIds: [...ids] });
                }}
              />
              <span className="font-mono text-2xs text-ink-3">#{ch.id}</span>
              <span className="min-w-0 flex-1 truncate">{ch.title}</span>
              <Badge
                tone={
                  ch.status === 'published'
                    ? 'success'
                    : ch.status === 'hidden'
                      ? 'warning'
                      : 'neutral'
                }
              >
                {CHALLENGE_STATUS[ch.status] ?? ch.status}
              </Badge>
            </label>
          ))}
          {filteredChallenges.length === 0 && (
            <p className="py-4 text-center text-2xs text-ink-3">
              {challengesQ.isLoading ? '加载中…' : '没有可绑定的题目。'}
            </p>
          )}
        </div>
      </Field>

      {canManageAll && (
        <>
          <AccessGrantEditor
            title="访问与修改授权"
            description="只读：私有赛事对授权对象可见；修改：允许授权对象编辑赛事元数据。激活、归档、删除和导出仍仅限全局赛事管理员。"
            grants={grants}
            onChange={(next) => {
              setGrants(next);
              patch({ accessGrants: next });
            }}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => patch({ isActive: e.target.checked })}
            />
            设为当前激活赛事（同一时刻只能有一个激活赛事）
          </label>
        </>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-rule pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>
          取消
        </Button>
        <Button type="submit" variant="primary" loading={saveMut.isPending}>
          {isEdit ? '保存' : '创建'}
        </Button>
      </div>
    </form>
  );
}
