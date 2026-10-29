import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Pencil } from 'lucide-react';
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
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '@/api/category';
import { ApiClientError } from '@/api/client';
import type { Category } from '@/types';

export function AdminCategoriesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', sortOrder: 0 });

  const list = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateCategory(editing.id, form);
      }
      return createCategory(form);
    },
    onSuccess: () => {
      toast.success(editing ? '已更新' : '已创建');
      qc.invalidateQueries({ queryKey: ['categories'] });
      reset();
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : '操作失败';
      toast.error(msg);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCategory(id),
    onSuccess: () => {
      toast.success('已删除');
      qc.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : '删除失败';
      toast.error(msg);
    },
  });

  function reset() {
    setEditing(null);
    setForm({ name: '', slug: '', description: '', sortOrder: 0 });
  }

  function startEdit(c: Category) {
    setEditing(c);
    setForm({
      name: c.name,
      slug: c.slug,
      description: c.description,
      sortOrder: c.sortOrder,
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>{editing ? '编辑分类' : '新建分类'}</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
            className="space-y-4"
          >
            <Field label="名称">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Web"
                required
              />
            </Field>
            <Field label="Slug" hint="用于 URL 的小写标识">
              <Input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="web"
                required
              />
            </Field>
            <Field label="描述">
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>
            <Field label="排序权重">
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))
                }
              />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" loading={saveMutation.isPending} className="flex-1">
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
          <CardTitle>已有分类（{list.data?.length ?? 0}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="py-10 text-center text-sm text-muted">加载中...</div>
          ) : list.data?.length ? (
            <ul className="divide-y divide-border">
              {list.data.map((c) => (
                <li key={c.id} className="px-5 py-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      <Badge>{c.slug}</Badge>
                      <span className="text-2xs text-muted">#{c.sortOrder}</span>
                    </div>
                    {c.description && (
                      <p className="text-2xs text-muted mt-1 line-clamp-2">{c.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(c)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (
                          confirm(
                            `确认删除分类「${c.name}」？\n若分类下仍有题目，删除会被拒绝。`,
                          )
                        ) {
                          deleteMutation.mutate(c.id);
                        }
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
              还没有任何分类，使用左侧表单创建第一个。
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
