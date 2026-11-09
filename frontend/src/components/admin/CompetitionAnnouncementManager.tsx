import i18n from '@/locales/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Field,
  Input,
  Spinner,
  useConfirm,
  useToast,
} from '@/components/ui';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import {
  createCompetitionAnnouncement,
  deleteCompetitionAnnouncement,
  listAdminCompetitionAnnouncements,
  updateCompetitionAnnouncement,
} from '@/api/competition';
import { ApiClientError } from '@/api/client';
import { formatTime } from '@/lib/utils';
import type { Competition, CompetitionAnnouncement } from '@/types';

const EMPTY = { title: '', contentMd: '', isPublished: true };

/**
 * Per-competition announcements. Drafts stay hidden until Publish now is checked;
 * the public feed reads `competition-announcements`, so both keys are
 * invalidated on every write.
 */
export function CompetitionAnnouncementManager({
  competition,
}: {
  competition: Competition;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState(EMPTY);
  const [editing, setEditing] = useState<CompetitionAnnouncement | null>(null);
  const [showForm, setShowForm] = useState(false);

  const listQ = useQuery({
    queryKey: ['admin-competition-announcements', competition.id],
    queryFn: () => listAdminCompetitionAnnouncements(competition.id, 1, 100),
    staleTime: 0,
  });

  const invalidate = () => {
    qc.invalidateQueries({
      queryKey: ['admin-competition-announcements', competition.id],
    });
    qc.invalidateQueries({ queryKey: ['competition-announcements', competition.id] });
  };

  const reset = () => {
    setEditing(null);
    setShowForm(false);
    setDraft(EMPTY);
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const input = {
        title: draft.title.trim(),
        contentMd: draft.contentMd,
        isPublished: draft.isPublished,
      };
      return editing
        ? updateCompetitionAnnouncement(competition.id, editing.id, input)
        : createCompetitionAnnouncement(competition.id, input);
    },
    onSuccess: () => {
      toast.success(editing ? i18n.t('公告已更新') : i18n.t('公告已发布'));
      reset();
      invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('保存失败')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCompetitionAnnouncement(competition.id, id),
    onSuccess: () => {
      toast.success(i18n.t('公告已删除'));
      invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('删除失败')),
  });

  const openNew = () => {
    setEditing(null);
    setDraft(EMPTY);
    setShowForm(true);
  };

  const openEdit = (a: CompetitionAnnouncement) => {
    setEditing(a);
    setDraft({ title: a.title, contentMd: a.contentMd, isPublished: a.isPublished });
    setShowForm(true);
  };

  const items = listQ.data?.items ?? [];

  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-3">{i18n.t('仅发布后的公告对参赛者可见。')}</p>
        <Button type="button" size="sm" variant="primary" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" />
          {i18n.t('新建公告')}
        </Button>
      </div>

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.title.trim()) return;
            saveMut.mutate();
          }}
          className="border border-rule rounded-sm p-4 space-y-3 bg-paper-2/40"
        >
          <Field label={i18n.t('标题')} htmlFor="ann-title">
            <Input
              id="ann-title"
              value={draft.title}
              maxLength={160}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              required
            />
          </Field>
          <Field label={i18n.t('内容')} htmlFor="ann-content" hint={i18n.t('支持 Markdown')}>
            <MarkdownEditor
              id="ann-content"
              rows={5}
              value={draft.contentMd}
              onChange={(contentMd) => setDraft((d) => ({ ...d, contentMd }))}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.isPublished}
              onChange={(e) =>
                setDraft((d) => ({ ...d, isPublished: e.target.checked }))
              }
            />
            {i18n.t('立即发布')}
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={reset}>
              {i18n.t('取消')}
            </Button>
            <Button
              type="submit"
              size="sm"
              variant="primary"
              loading={saveMut.isPending}
              disabled={!draft.title.trim()}
            >
              {editing ? i18n.t('保存') : i18n.t('创建')}
            </Button>
          </div>
        </form>
      )}

      {listQ.isLoading ? (
        <div className="py-8 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : listQ.isError ? (
        <p className="text-sm text-ink-3">{i18n.t('无法加载公告。')}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-ink-3">{i18n.t('暂无公告。')}</p>
      ) : (
        <ul className="border-t border-rule">
          {items.map((a) => (
            <li
              key={a.id}
              className="py-3 border-b border-rule flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-medium text-ink">{a.title}</h4>
                  <Badge tone={a.isPublished ? 'success' : 'neutral'}>
                    {a.isPublished ? i18n.t('已发布') : i18n.t('草稿')}
                  </Badge>
                </div>
                <p className="mt-1 font-mono text-2xs text-ink-3">
                  {formatTime(a.createdAt)}
                </p>
                {a.contentMd && (
                  <p className="mt-1 text-2xs text-ink-3 line-clamp-2">{a.contentMd}</p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => openEdit(a)}
                >
                  {i18n.t('编辑')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  loading={deleteMut.isPending && deleteMut.variables === a.id}
                  onClick={async () => {
                    const ok = await confirm({
                      title: i18n.t('删除赛事公告'),
                      description: i18n.t('公告「{{v0}}」将被删除，无法恢复。', { v0: a.title }),
                      confirmText: i18n.t('删除'),
                    });
                    if (ok) deleteMut.mutate(a.id);
                  }}
                  aria-label={i18n.t('删除公告 {{v0}}', { v0: a.title })}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
