import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, Pencil, Pin, Plus, Eye } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Textarea,
  useToast,
} from '@/components/ui';
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from '@/api/announcement';
import { ApiClientError } from '@/api/client';
import { formatTime } from '@/lib/utils';
import type { Announcement } from '@/types';

export function AdminAnnouncementsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState({
    title: '',
    contentMd: '',
    isPinned: false,
    isPublished: true,
  });

  const list = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: () => listAnnouncements(1, 100),
    staleTime: 30_000,
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) return updateAnnouncement(editing.id, form);
      return createAnnouncement(form);
    },
    onSuccess: () => {
      toast.success(editing ? '已更新' : '已创建');
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements'] });
      reset();
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteAnnouncement(id),
    onSuccess: () => {
      toast.success('已删除');
      qc.invalidateQueries({ queryKey: ['admin-announcements'] });
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '删除失败'),
  });

  function reset() {
    setEditing(null);
    setForm({ title: '', contentMd: '', isPinned: false, isPublished: true });
  }

  function startEdit(a: Announcement) {
    setEditing(a);
    setForm({
      title: a.title,
      contentMd: a.contentMd,
      isPinned: a.isPinned,
      isPublished: a.isPublished,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>{editing ? '编辑公告' : '新建公告'}</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMut.mutate();
            }}
            className="space-y-4"
          >
            <Field label="标题">
              <Input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="重要通知..."
                required
              />
            </Field>
            <Field label="正文（Markdown）">
              <Textarea
                rows={10}
                value={form.contentMd}
                onChange={(e) => setForm((f) => ({ ...f, contentMd: e.target.value }))}
                placeholder="可以使用 Markdown 语法..."
              />
            </Field>
            <div className="flex items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
                />
                <span>置顶</span>
              </label>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
                />
                <span>立即发布</span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="submit" loading={saveMut.isPending} className="flex-1">
                {editing ? '保存修改' : '创建'}
              </Button>
              {editing && (
                <Button type="button" variant="outline" onClick={reset}>
                  取消
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>已有公告（{list.data?.total ?? 0}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="py-10 text-center text-sm text-muted">加载中...</div>
          ) : list.data?.items?.length ? (
            <ul className="divide-y divide-border">
              {list.data.items.map((a) => (
                <li key={a.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{a.title}</span>
                      {a.isPinned && (
                        <Badge tone="warning">
                          <Pin className="h-3 w-3" /> 置顶
                        </Badge>
                      )}
                      {a.isPublished ? (
                        <Badge tone="success">
                          <Eye className="h-3 w-3" /> 已发布
                        </Badge>
                      ) : (
                        <Badge>草稿</Badge>
                      )}
                    </div>
                    <div className="text-2xs text-muted mt-1">
                      {a.publishedAt ? `发布于 ${formatTime(a.publishedAt)}` : formatTime(a.createdAt)}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(a)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`确认删除公告「${a.title}」？`)) deleteMut.mutate(a.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center text-sm text-muted">
              还没有任何公告，
              <Plus className="inline h-3 w-3" />
              创建第一条吧
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
