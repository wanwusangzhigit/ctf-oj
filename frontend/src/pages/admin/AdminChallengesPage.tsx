import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
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
import { listCategories } from '@/api/category';
import {
  listChallenges,
  createChallenge,
  deleteChallenge,
  type ChallengeInput,
  type FlagInput,
} from '@/api/challenge';
import { ApiClientError } from '@/api/client';

const EMPTY: ChallengeInput = {
  categoryId: 0,
  title: '',
  description: '',
  baseScore: 500,
  minScore: 100,
  decay: 10,
  difficulty: 2,
  isPublished: false,
  connectionInfo: '',
  tags: '',
  flags: [{ type: 'static', content: '', caseSensitive: true }],
};

export function AdminChallengesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState<ChallengeInput>(EMPTY);

  const cats = useQuery({ queryKey: ['categories'], queryFn: listCategories });
  const list = useQuery({
    queryKey: ['admin-challenges'],
    queryFn: () => listChallenges({ scope: 'admin', pageSize: 100 }),
  });

  const createMut = useMutation({
    mutationFn: (input: ChallengeInput) => createChallenge(input),
    onSuccess: () => {
      toast.success('已创建');
      qc.invalidateQueries({ queryKey: ['admin-challenges'] });
      qc.invalidateQueries({ queryKey: ['challenges'] });
      setForm({ ...EMPTY, categoryId: cats.data?.[0]?.id ?? 0 });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '创建失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteChallenge(id),
    onSuccess: () => {
      toast.success('已删除');
      qc.invalidateQueries({ queryKey: ['admin-challenges'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '删除失败'),
  });

  function updateFlag(idx: number, patch: Partial<FlagInput>) {
    setForm((f) => ({
      ...f,
      flags: f.flags.map((fl, i) => (i === idx ? { ...fl, ...patch } : fl)),
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.categoryId) {
      toast.error('请选择分类');
      return;
    }
    if (!form.title.trim()) {
      toast.error('请填写题目名称');
      return;
    }
    if (form.flags.some((f) => !f.content.trim())) {
      toast.error('请完善所有 Flag 内容');
      return;
    }
    createMut.mutate(form);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>新建题目</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="标题">
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  required
                />
              </Field>
              <Field label="分类">
                <select
                  value={form.categoryId}
                  onChange={(e) => setForm((f) => ({ ...f, categoryId: Number(e.target.value) }))}
                  className="w-full h-9 px-3 bg-surface border border-border rounded-md text-sm focus:outline-none focus:border-accent"
                >
                  <option value={0}>请选择</option>
                  {cats.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="描述">
              <Textarea
                rows={5}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </Field>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="基础分">
                <Input
                  type="number"
                  value={form.baseScore}
                  onChange={(e) => setForm((f) => ({ ...f, baseScore: Number(e.target.value) }))}
                />
              </Field>
              <Field label="最低分">
                <Input
                  type="number"
                  value={form.minScore}
                  onChange={(e) => setForm((f) => ({ ...f, minScore: Number(e.target.value) }))}
                />
              </Field>
              <Field label="衰减系数">
                <Input
                  type="number"
                  value={form.decay}
                  onChange={(e) => setForm((f) => ({ ...f, decay: Number(e.target.value) }))}
                />
              </Field>
              <Field label="难度">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={form.difficulty}
                  onChange={(e) => setForm((f) => ({ ...f, difficulty: Number(e.target.value) }))}
                />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="连接信息（可选）" hint="例如 nc host 1337">
                <Input
                  value={form.connectionInfo}
                  onChange={(e) => setForm((f) => ({ ...f, connectionInfo: e.target.value }))}
                />
              </Field>
              <Field label="标签（逗号分隔）">
                <Input
                  value={form.tags}
                  onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                  placeholder="web,sqli"
                />
              </Field>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Flag 配置</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      flags: [...f.flags, { type: 'static', content: '', caseSensitive: true }],
                    }))
                  }
                >
                  + 添加 Flag
                </Button>
              </div>
              {form.flags.map((fl, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <select
                    className="col-span-3 h-9 px-2 bg-surface border border-border rounded-md text-sm"
                    value={fl.type}
                    onChange={(e) => updateFlag(i, { type: e.target.value as FlagInput['type'] })}
                  >
                    <option value="static">static</option>
                    <option value="regex">regex</option>
                  </select>
                  <Input
                    className="col-span-7 font-mono"
                    placeholder="flag{...} 或正则表达式"
                    value={fl.content}
                    onChange={(e) => updateFlag(i, { content: e.target.value })}
                  />
                  <label className="col-span-1 flex items-center justify-center h-9 text-2xs text-muted cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fl.caseSensitive}
                      onChange={(e) => updateFlag(i, { caseSensitive: e.target.checked })}
                    />
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    disabled={form.flags.length === 1}
                    onClick={() =>
                      setForm((f) => ({ ...f, flags: f.flags.filter((_, j) => j !== i) }))
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <p className="text-2xs text-muted">复选框表示大小写敏感。</p>
            </div>

            <div className="flex items-center gap-2">
              <input
                id="publish"
                type="checkbox"
                checked={form.isPublished}
                onChange={(e) => setForm((f) => ({ ...f, isPublished: e.target.checked }))}
              />
              <label htmlFor="publish" className="text-sm">
                立即发布
              </label>
            </div>

            <Button type="submit" loading={createMut.isPending} size="lg">
              创建题目
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>题目列表（{list.data?.total ?? 0}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="py-10 text-center text-sm text-muted">加载中...</div>
          ) : list.data?.items?.length ? (
            <ul className="divide-y divide-border">
              {list.data.items.map((c) => (
                <li key={c.id} className="px-5 py-3 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{c.title}</span>
                      {c.isPublished ? (
                        <Badge tone="success">已发布</Badge>
                      ) : (
                        <Badge>草稿</Badge>
                      )}
                    </div>
                    <div className="text-2xs text-muted mt-0.5">
                      {c.category?.name ?? '—'} · {c.solveCount} 人已解
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm(`确认删除题目「${c.title}」？`)) deleteMut.mutate(c.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-10 text-center text-sm text-muted">暂无题目。</div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
