import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { Button, Card, CardBody, Input, Spinner, Textarea, useConfirm, useToast } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import {
  createWriteup,
  deleteWriteup,
  listWriteups,
  updateWriteup,
} from '@/api/writeup';
import { relativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { hasPermission } from '@/lib/permissions';
import { ApiClientError } from '@/api/client';

export function WriteupsPanel({
  challengeId,
  competitionId,
  solved,
}: {
  challengeId: number;
  competitionId?: number;
  solved: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const user = useAuthStore((s) => s.user);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const list = useQuery({
    queryKey: ['writeups', challengeId, competitionId ?? 0],
    queryFn: () => listWriteups(challengeId, competitionId),
    staleTime: 30_000,
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createWriteup(challengeId, { title, contentMd: content }, competitionId),
    onSuccess: () => {
      setTitle('');
      setContent('');
      qc.invalidateQueries({ queryKey: ['writeups', challengeId, competitionId ?? 0] });
      toast.success('Writeup 已发布');
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '发布失败'),
  });

  const toggleMut = useMutation({
    mutationFn: (w: { id: number; isPublished: boolean }) =>
      updateWriteup(w.id, { isPublished: !w.isPublished }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['writeups', challengeId, competitionId ?? 0] }),
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => deleteWriteup(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['writeups', challengeId, competitionId ?? 0] });
      toast.success('已删除');
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '删除失败'),
  });

  if (!user) return null;

  return (
    <Card>
      <CardBody className="space-y-5">
        <div>
          <h3 className="text-base font-semibold">Writeup</h3>
          <p className="text-2xs text-ink-3 mt-0.5">
            解题后可发布题解，其他解题者可见。
          </p>
        </div>

        {solved && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!title.trim() || !content.trim()) return;
              createMut.mutate();
            }}
            className="space-y-2"
          >
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题"
            />
            <Textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="解题思路（Markdown）"
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                loading={createMut.isPending}
                disabled={!title.trim() || !content.trim()}
              >
                发布
              </Button>
            </div>
          </form>
        )}

        {list.isLoading ? (
          <Spinner className="h-4 w-4 text-ink-3" />
        ) : (list.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-3">
            {solved ? '还没有 Writeup。' : '解出题目后可查看 Writeup。'}
          </p>
        ) : (
          <ul className="border-t border-rule">
            {list.data!.map((w) => {
              const canEdit = hasPermission(user, 'challenge.manage') || user.id === w.author.id;
              return (
                <li key={w.id} className="py-4 border-b border-rule space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{w.title}</span>
                    {!w.isPublished && <span className="font-mono text-2xs text-ink-3">未发布</span>}
                    <span className="font-mono text-2xs text-ink-3">
                      {w.author.username} · {relativeTime(w.createdAt)}
                    </span>
                    {canEdit && (
                      <span className="ml-auto flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleMut.mutate({ id: w.id, isPublished: w.isPublished })}
                          className="inline-flex items-center gap-1 h-7 px-2 text-2xs text-ink-3 hover:bg-paper-2 rounded-sm"
                        >
                          {w.isPublished ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          {w.isPublished ? '隐藏' : '公开'}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            const ok = await confirm({
                              title: '删除 Writeup',
                              description: '这篇 Writeup 将被删除，无法恢复。',
                              confirmText: '删除',
                            });
                            if (ok) delMut.mutate(w.id);
                          }}
                          className="inline-flex items-center gap-1 h-7 px-2 text-2xs text-ink-3 hover:text-danger hover:bg-paper-2 rounded-sm"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                  <div className="max-w-prose">
                    <Markdown>{w.contentMd}</Markdown>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
