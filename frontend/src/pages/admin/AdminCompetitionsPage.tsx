import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Star, Pencil, Trash2, Megaphone, Users } from 'lucide-react';
import {
  Button,
  Field,
  Input,
  Textarea,
  Spinner,
  Badge,
  useToast,
} from '@/components/ui';
import {
  listCompetitions,
  getCompetition,
  createCompetition,
  updateCompetition,
  deleteCompetition,
  exportCompetitionScores,
  listAdminCompetitionAnnouncements,
  createCompetitionAnnouncement,
  updateCompetitionAnnouncement,
  deleteCompetitionAnnouncement,
  listCompetitionRegistrations,
  setCompetitionScoreExcluded,
} from '@/api/competition';
import { listChallenges } from '@/api/challenge';
import { useSiteStore } from '@/stores/site';
import { ApiClientError } from '@/api/client';
import { formatTime } from '@/lib/utils';
import type {
  AccessSubject,
  ChallengeStatus,
  Competition,
  CompetitionAnnouncement,
  CompetitionInput,
  CompetitionRegistration,
} from '@/types';
import { AccessGrantEditor } from '@/components/admin/ChallengeAccessEditor';
import { useAuthStore } from '@/stores/auth';
import { hasPermission } from '@/lib/permissions';

const CHALLENGE_STATUS: Record<ChallengeStatus, string> = {
  draft: '草稿',
  hidden: '隐藏',
  published: '已发布',
  archived: '归档',
};

/**
 * AdminCompetitionsPage — CRUD for competitions.
 * Only one competition may be active at a time — server enforces singleton.
 *
 * The competition is mostly metadata (start/end/freeze timestamps);
 * the actual scoreboard is computed from solves filtered by these times.
 */
export function AdminCompetitionsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const canManageAll = hasPermission(user, 'competition.manage');
  const [editing, setEditing] = useState<Competition | null>(null);
  const [creating, setCreating] = useState(false);
  const [announcementFor, setAnnouncementFor] = useState<Competition | null>(null);
  const [registrationFor, setRegistrationFor] = useState<Competition | null>(null);

  const listQ = useQuery({
    queryKey: ['admin-competitions'],
    queryFn: () => listCompetitions(1, 100, 'admin'),
    staleTime: 30_000,
  });

  const exportMut = useMutation({
    mutationFn: (c: Competition) => exportCompetitionScores(c.id, 'user', c.slug),
    onSuccess: () => toast.success('成绩已导出'),
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '导出失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCompetition(id),
    onSuccess: () => {
      toast.success('已删除');
      qc.invalidateQueries({ queryKey: ['admin-competitions'] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '删除失败'),
  });

  return (
    <div className="space-y-6">
      <header className="border-t-2 border-ink pt-6 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-2xs text-ink-3 mb-3">
            $ sudo admin --competitions
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            赛事
          </h2>
          <p className="mt-1 text-sm text-ink-3 max-w-prose">
            {canManageAll
              ? '比赛窗口、记分板冻结窗口的元数据。同时只有一个赛事处于激活状态。'
              : '你被授予了这些赛事的修改权限，可编辑赛事元数据。'}
          </p>
        </div>
        {canManageAll && (
          <Button
            variant="primary"
            className="shrink-0 whitespace-nowrap"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-3.5 w-3.5" /> 新建赛事
          </Button>
        )}
      </header>

      {listQ.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : listQ.isError ? (
        <div className="py-10 text-center text-sm text-ink-3">
          无法加载赛事列表。
        </div>
      ) : (listQ.data?.items?.length ?? 0) === 0 ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          {canManageAll ? '尚未创建任何赛事。' : '没有可管理的赛事。'}
        </div>
      ) : (
        <ul className="border-t border-ink">
          {listQ.data!.items.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[1fr_auto] gap-4 py-4 border-b border-rule"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-ink">{c.name}</h3>
                  {c.isActive && (
                    <Badge tone="accent">
                      <Star className="h-3 w-3" />
                      当前赛事
                    </Badge>
                  )}
                  {c.registrationRequired && <Badge tone="warning">需报名</Badge>}
                </div>
                <div className="font-mono text-2xs text-ink-3 mt-0.5 tabular-nums">
                  {c.startAt ? formatTime(c.startAt) : '—'} → {c.endAt ? formatTime(c.endAt) : '—'}
                  {c.freezeAt && ` · freeze ${formatTime(c.freezeAt)}`}
                </div>
                {c.description && (
                  <p className="text-sm text-ink-2 mt-2 max-w-prose line-clamp-2">
                    {c.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-ink-3">
                  <span className="font-mono">
                    {c.challenges?.length ?? 0} 道题
                  </span>
                  {(c.challenges?.filter((ch) => ch.status === 'hidden').length ?? 0) > 0 && (
                    <Badge tone="warning">
                      {c.challenges!.filter((ch) => ch.status === 'hidden').length} 隐藏
                    </Badge>
                  )}
                </div>
                {c.challenges && c.challenges.length > 0 ? (
                  <details className="mt-1 text-2xs text-ink-3">
                    <summary className="cursor-pointer select-none hover:text-ink">
                      查看题目列表
                    </summary>
                    <ul className="mt-1.5 space-y-1 border-l border-rule pl-3">
                      {c.challenges.map((ch) => (
                        <li key={ch.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-ink-2">
                            {ch.title}
                          </span>
                          <span className="font-mono tabular-nums">
                            {CHALLENGE_STATUS[ch.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="mt-1 text-2xs text-ink-3">
                    未绑定题目，计分覆盖全部公开题目。
                  </p>
                )}
              </div>
              <div className="flex items-start gap-1">
                {canManageAll && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={exportMut.isPending && exportMut.variables?.id === c.id}
                    onClick={() => exportMut.mutate(c)}
                    aria-label="导出成绩"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAnnouncementFor(c)}
                  aria-label="比赛公告"
                >
                  <Megaphone className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRegistrationFor(c)}
                  aria-label="报名与成绩"
                >
                  <Users className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(c)}
                  aria-label="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {canManageAll && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={deleteMut.isPending}
                    onClick={() => {
                      if (confirm(`删除赛事「${c.name}」？该操作不可撤销。`)) {
                        deleteMut.mutate(c.id);
                      }
                    }}
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {(creating || editing) && (
        <CompetitionModal
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
      {announcementFor && (
        <CompetitionAnnouncementsModal
          competition={announcementFor}
          onClose={() => setAnnouncementFor(null)}
        />
      )}
      {registrationFor && (
        <CompetitionRegistrationsModal
          competition={registrationFor}
          onClose={() => setRegistrationFor(null)}
        />
      )}
    </div>
  );
}

function CompetitionModal({
  initial,
  onClose,
}: {
  initial: Competition | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const reloadSite = useSiteStore((s) => s.load);
  const user = useAuthStore((s) => s.user);
  const canManageAll = hasPermission(user, 'competition.manage');
  const isEdit = !!initial;

  const [form, setForm] = useState<CompetitionInput>({
    name: initial?.name ?? '',
    slug: initial?.slug ?? '',
    description: initial?.description ?? '',
    startAt: initial?.startAt ?? '',
    endAt: initial?.endAt ?? '',
    freezeAt: initial?.freezeAt ?? '',
    isActive: initial?.isActive ?? false,
    registrationCode: initial?.registrationCode ?? '',
    registrationRequired: initial?.registrationRequired ?? false,
    visibility: initial?.visibility ?? 'public',
    scoringMode: initial?.scoringMode ?? 'dynamic',
    challengeIds: initial?.challenges?.map((ch) => ch.id) ?? [],
    archived: !!initial?.archivedAt,
  });
  const [pending, setPending] = useState(false);
  const [grants, setGrants] = useState<AccessSubject[]>(initial?.accessGrants ?? []);
  const [challengeQuery, setChallengeQuery] = useState('');
  const detailQ = useQuery({
    queryKey: ['admin-competition', initial?.id],
    queryFn: () => getCompetition(initial!.id, 'admin'),
    enabled: isEdit && canManageAll && !!initial,
    staleTime: 0,
  });

  useEffect(() => {
    if (!detailQ.data) return;
    setGrants(detailQ.data.accessGrants ?? []);
    setForm((f) => ({ ...f, accessGrants: detailQ.data.accessGrants ?? [] }));
  }, [detailQ.data]);
  const challengesQ = useQuery({
    queryKey: ['admin-challenges', 'for-competition'],
    queryFn: () => listChallenges({ scope: 'admin', pageSize: 100 }),
    staleTime: 60_000,
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      const cleaned: CompetitionInput = {
        ...form,
        startAt: form.startAt || undefined,
        endAt: form.endAt || undefined,
        freezeAt: form.freezeAt || undefined,
        registrationCode: form.registrationCode || undefined,
        accessGrants: canManageAll ? grants : undefined,
      };
      if (isEdit && initial) {
        await updateCompetition(initial.id, cleaned);
        toast.success('已保存');
      } else {
        await createCompetition(cleaned);
        toast.success('已创建');
      }
      qc.invalidateQueries({ queryKey: ['admin-competitions'] });
      reloadSite();
      onClose();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : '保存失败';
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper-3/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border border-rule-strong rounded-sm shadow-popover w-full max-w-xl max-h-[90vh] overflow-auto"
      >
        <div className="px-5 py-4 border-b border-rule">
          <h3 className="font-semibold text-ink">
            {isEdit ? '编辑赛事' : '新建赛事'}
          </h3>
          <p className="text-2xs text-ink-3 mt-0.5">
            {isEdit ? '修改已有赛事的元数据' : '创建一场新的比赛'}
          </p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="名称" htmlFor="name">
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
            </Field>
            <Field label="slug" htmlFor="slug" hint="用于 URL">
              <Input
                id="slug"
                required
                value={form.slug}
                onChange={(e) =>
                  setForm((f) => ({ ...f, slug: e.target.value }))
                }
              />
            </Field>
          </div>
          <Field label="描述" htmlFor="desc">
            <Textarea
              id="desc"
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="开始时间" htmlFor="start">
              <Input
                id="start"
                type="datetime-local"
                value={form.startAt?.slice(0, 16) ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    startAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : '',
                  }))
                }
              />
            </Field>
            <Field label="结束时间" htmlFor="end">
              <Input
                id="end"
                type="datetime-local"
                value={form.endAt?.slice(0, 16) ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    endAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : '',
                  }))
                }
              />
            </Field>
            <Field label="冻结时间" htmlFor="freeze" hint="可选">
              <Input
                id="freeze"
                type="datetime-local"
                value={form.freezeAt?.slice(0, 16) ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    freezeAt: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : '',
                  }))
                }
              />
            </Field>
          </div>
          <Field
            label="报名邀请码"
            htmlFor="regCode"
            hint="可选 —— 设置后报名需要此码"
          >
            <Input
              id="regCode"
              value={form.registrationCode ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, registrationCode: e.target.value }))
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="可见性" htmlFor="visibility">
              <select
                id="visibility"
                value={form.visibility ?? 'public'}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    visibility: e.target.value as 'public' | 'private',
                  }))
                }
                className="h-9 px-2 w-full bg-paper border border-rule rounded-sm text-sm"
              >
                <option value="public">公开</option>
                <option value="private">私有（仅管理员可见）</option>
              </select>
            </Field>
            <Field label="计分模式" htmlFor="scoringMode" hint="固定=原始分；三血=前三解有加成">
              <select
                id="scoringMode"
                value={form.scoringMode ?? 'dynamic'}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    scoringMode: e.target.value as CompetitionInput['scoringMode'],
                  }))
                }
                className="h-9 px-2 w-full bg-paper border border-rule rounded-sm text-sm"
              >
                <option value="dynamic">动态分值</option>
                <option value="fixed">固定分值</option>
                <option value="three_blood">三血加成</option>
              </select>
            </Field>
            <Field label="报名" htmlFor="registrationRequired" hint="开启后未报名不能提交赛事题或参与答疑">
              <label className="flex items-center gap-2 h-9 text-sm">
                <input
                  id="registrationRequired"
                  type="checkbox"
                  checked={form.registrationRequired ?? false}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      registrationRequired: e.target.checked,
                    }))
                  }
                />
                必须报名
              </label>
            </Field>
            {canManageAll && (
              <Field label="归档" htmlFor="archived" hint="归档后从公开列表隐藏">
                <label className="flex items-center gap-2 h-9 text-sm">
                  <input
                    id="archived"
                    type="checkbox"
                    checked={form.archived ?? false}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, archived: e.target.checked }))
                    }
                  />
                  已归档
                </label>
              </Field>
            )}
          </div>
          <Field
            label={`绑定题目（已选 ${form.challengeIds?.length ?? 0}）`}
            hint="不选则计入全部题目；隐藏题目需在题目编辑页单独授权"
          >
            <div className="mb-2 flex items-center gap-2">
              <Input
                value={challengeQuery}
                onChange={(e) => setChallengeQuery(e.target.value)}
                placeholder="按标题或 ID 筛选"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setForm((f) => ({ ...f, challengeIds: [] }))}
              >
                清空
              </Button>
            </div>
            <div className="max-h-56 overflow-auto border border-rule rounded-sm p-2 space-y-1">
              {(challengesQ.data?.items ?? [])
                .filter((ch) => {
                  const q = challengeQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    ch.title.toLowerCase().includes(q) ||
                    String(ch.id) === q ||
                    `#${ch.id}` === q
                  );
                })
                .map((ch) => (
                  <label key={ch.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={(form.challengeIds ?? []).includes(ch.id)}
                      onChange={(e) =>
                        setForm((f) => {
                          const ids = new Set(f.challengeIds ?? []);
                          if (e.target.checked) ids.add(ch.id);
                          else ids.delete(ch.id);
                          return { ...f, challengeIds: [...ids] };
                        })
                      }
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
              {(challengesQ.data?.items ?? []).length === 0 && (
                <p className="py-4 text-center text-2xs text-ink-3">没有可绑定的题目。</p>
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
                  setForm((f) => ({ ...f, accessGrants: next }));
                }}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isActive: e.target.checked }))
                  }
                />
                设为当前激活赛事（同一时刻只能有一个激活赛事）
              </label>
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-rule flex items-center justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={pending} variant="primary">
            {isEdit ? '保存' : '创建'}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CompetitionAnnouncementsModal({
  competition,
  onClose,
}: {
  competition: Competition;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const listQ = useQuery({
    queryKey: ['admin-competition-announcements', competition.id],
    queryFn: () => listAdminCompetitionAnnouncements(competition.id, 1, 100),
    staleTime: 0,
  });
  const [editing, setEditing] = useState<CompetitionAnnouncement | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [contentMd, setContentMd] = useState('');
  const [isPublished, setIsPublished] = useState(true);

  const resetForm = () => {
    setEditing(null);
    setShowForm(false);
    setTitle('');
    setContentMd('');
    setIsPublished(true);
  };

  const openNew = () => {
    setEditing(null);
    setTitle('');
    setContentMd('');
    setIsPublished(true);
    setShowForm(true);
  };

  const openEdit = (a: CompetitionAnnouncement) => {
    setEditing(a);
    setTitle(a.title);
    setContentMd(a.contentMd);
    setIsPublished(a.isPublished);
    setShowForm(true);
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const input = { title: title.trim(), contentMd, isPublished };
      return editing
        ? updateCompetitionAnnouncement(competition.id, editing.id, input)
        : createCompetitionAnnouncement(competition.id, input);
    },
    onSuccess: () => {
      toast.success(editing ? '公告已更新' : '公告已发布');
      resetForm();
      qc.invalidateQueries({
        queryKey: ['admin-competition-announcements', competition.id],
      });
      qc.invalidateQueries({
        queryKey: ['competition-announcements', competition.id],
      });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '保存失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCompetitionAnnouncement(competition.id, id),
    onSuccess: () => {
      toast.success('公告已删除');
      qc.invalidateQueries({
        queryKey: ['admin-competition-announcements', competition.id],
      });
      qc.invalidateQueries({
        queryKey: ['competition-announcements', competition.id],
      });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '删除失败'),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper-3/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border border-rule-strong rounded-sm shadow-popover w-full max-w-2xl max-h-[90vh] overflow-auto"
      >
        <div className="px-5 py-4 border-b border-rule flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink">比赛公告</h3>
            <p className="text-2xs text-ink-3 mt-0.5">
              {competition.name} · 仅发布后的公告对参赛者可见
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant="primary" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" />
              新建公告
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onClose}>
              关闭
            </Button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {showForm && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!title.trim()) return;
                saveMut.mutate();
              }}
              className="border border-rule rounded-sm p-4 space-y-3 bg-paper-2/40"
            >
              <Field label="标题" htmlFor="ann-title">
                <Input
                  id="ann-title"
                  value={title}
                  maxLength={160}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </Field>
              <Field label="内容" htmlFor="ann-content" hint="Markdown">
                <Textarea
                  id="ann-content"
                  rows={5}
                  value={contentMd}
                  onChange={(e) => setContentMd(e.target.value)}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                />
                立即发布
              </label>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                  取消
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  loading={saveMut.isPending}
                  disabled={!title.trim()}
                >
                  {editing ? '保存' : '创建'}
                </Button>
              </div>
            </form>
          )}

          {listQ.isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <Spinner className="h-5 w-5 text-ink-3" />
            </div>
          ) : listQ.isError ? (
            <p className="text-sm text-ink-3">无法加载公告。</p>
          ) : (listQ.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-3">暂无公告。</p>
          ) : (
            <ul className="border-t border-rule">
              {listQ.data!.items.map((a) => (
                <li
                  key={a.id}
                  className="py-3 border-b border-rule flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-medium text-ink">{a.title}</h4>
                      <Badge tone={a.isPublished ? 'success' : 'neutral'}>
                        {a.isPublished ? '已发布' : '草稿'}
                      </Badge>
                    </div>
                    <p className="mt-1 font-mono text-2xs text-ink-3">
                      {formatTime(a.createdAt)}
                    </p>
                    {a.contentMd && (
                      <p className="mt-1 text-2xs text-ink-3 line-clamp-2">
                        {a.contentMd}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(a)}
                    >
                      编辑
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      loading={deleteMut.isPending}
                      onClick={() => {
                        if (confirm(`删除公告「${a.title}」？`)) {
                          deleteMut.mutate(a.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function CompetitionRegistrationsModal({
  competition,
  onClose,
}: {
  competition: Competition;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const listQ = useQuery({
    queryKey: ['admin-competition-registrations', competition.id],
    queryFn: () => listCompetitionRegistrations(competition.id, 1, 100),
    staleTime: 0,
  });

  const excludeMut = useMutation({
    mutationFn: ({
      userId,
      excluded,
    }: {
      userId: number;
      excluded: boolean;
    }) =>
      setCompetitionScoreExcluded(
        competition.id,
        userId,
        excluded,
        excluded ? '管理员取消成绩' : undefined,
      ),
    onSuccess: (_data, variables) => {
      toast.success(variables.excluded ? '成绩已取消' : '成绩已恢复');
      qc.invalidateQueries({
        queryKey: ['admin-competition-registrations', competition.id],
      });
      qc.invalidateQueries({
        queryKey: ['competition-scoreboard', competition.id],
      });
      qc.invalidateQueries({
        queryKey: ['competition-team-scoreboard', competition.id],
      });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-paper-3/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-paper border border-rule-strong rounded-sm shadow-popover w-full max-w-2xl max-h-[90vh] overflow-auto"
      >
        <div className="px-5 py-4 border-b border-rule flex items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-ink">报名与成绩</h3>
            <p className="text-2xs text-ink-3 mt-0.5">
              {competition.name} · 取消成绩会从赛事榜移除，并阻止继续提交赛事题
            </p>
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={onClose}>
            关闭
          </Button>
        </div>

        <div className="p-5">
          {listQ.isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <Spinner className="h-5 w-5 text-ink-3" />
            </div>
          ) : listQ.isError ? (
            <p className="text-sm text-ink-3">无法加载报名名单。</p>
          ) : (listQ.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-3">暂无报名用户。</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-2xs uppercase text-ink-3 border-b border-rule">
                  <th className="text-left py-2 font-medium">用户</th>
                  <th className="text-left py-2 font-medium">报名时间</th>
                  <th className="text-left py-2 font-medium">状态</th>
                  <th className="text-right py-2 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {listQ.data!.items.map((r: CompetitionRegistration) => (
                  <tr key={r.userId} className="border-b border-rule">
                    <td className="py-2">
                      <Link to={`/users/${r.userId}`} className="hover:no-underline">
                        {r.user?.username ?? `#${r.userId}`}
                      </Link>
                    </td>
                    <td className="py-2 font-mono text-2xs text-ink-3">
                      {formatTime(r.createdAt)}
                    </td>
                    <td className="py-2">
                      {r.scoreExcluded ? (
                        <Badge tone="danger">成绩已取消</Badge>
                      ) : (
                        <Badge tone="success">正常</Badge>
                      )}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        loading={
                          excludeMut.isPending &&
                          excludeMut.variables?.userId === r.userId
                        }
                        onClick={() => {
                          const next = !r.scoreExcluded;
                          if (
                            confirm(
                              next
                                ? `取消 ${r.user?.username ?? `#${r.userId}`} 的赛事成绩？`
                                : `恢复 ${r.user?.username ?? `#${r.userId}`} 的赛事成绩？`,
                            )
                          ) {
                            excludeMut.mutate({
                              userId: r.userId,
                              excluded: next,
                            });
                          }
                        }}
                      >
                        {r.scoreExcluded ? '恢复成绩' : '取消成绩'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
