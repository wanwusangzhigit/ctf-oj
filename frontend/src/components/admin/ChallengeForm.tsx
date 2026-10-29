import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Field, Input, Spinner, Textarea, useToast } from '@/components/ui';
import { SourceFileManager } from './SourceFileManager';
import { AttachmentManager } from './AttachmentManager';
import { HintManager } from './HintManager';
import { ChallengeAccessEditor } from './ChallengeAccessEditor';
import { listCategories } from '@/api/category';
import {
  createChallenge,
  deleteAttachment,
  getChallengeAdmin,
  updateChallenge,
  uploadAttachment,
  type ChallengeInput,
  type FlagInput,
} from '@/api/challenge';
import { ApiClientError } from '@/api/client';
import type { Attachment } from '@/types';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { hasPermission } from '@/lib/permissions';

const EMPTY: ChallengeInput = {
  categoryId: 0,
  title: '',
  description: '',
  baseScore: 500,
  minScore: 100,
  decay: 10,
  difficulty: 2,
  status: 'draft',
  isPublished: false,
  connectionInfo: '',
  tags: '',
  isDynamic: false,
  image: '',
  internalPort: 0,
  protocol: 'tcp',
  sourceType: 'image',
  buildContext: '',
  defaultTtl: 7200,
  memoryLimitMb: 256,
  cpuLimit: 1,
  pidsLimit: 0,
  editorial: '',
  flags: [{ type: 'static', content: '', caseSensitive: true }],
  accessGrants: [],
};

type SelectStyle = string;

const selectCls: SelectStyle =
  'w-full h-9 px-3 bg-paper border border-rule rounded-sm text-sm focus:outline-none focus:border-amber transition-colors';

/**
 * ChallengeForm — the form body used by both the "new" and "edit" pages.
 *
 * mode='create'        → POST on submit, no attachment / source panels
 * mode='edit'          → PUT on submit, with attachment + source panels
 *
 * On a successful create, calls onCreated(newId) so the parent can navigate
 * to the edit route (letting the user upload attachments etc).
 */
export function ChallengeForm({
  mode,
  challengeId,
  onCreated,
  onSaved,
}: {
  mode: 'create' | 'edit';
  challengeId?: number;
  onCreated?: (id: number) => void;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const canManageGrants = hasPermission(user, 'challenge.manage');
  const [form, setForm] = useState<ChallengeInput>(EMPTY);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [titleSnapshot, setTitleSnapshot] = useState<string>('');

  const cats = useQuery({ queryKey: ['categories'], queryFn: listCategories });

  // Pre-fill the create form with the first category id once cats load.
  useEffect(() => {
    if (mode === 'create' && form.categoryId === 0 && cats.data && cats.data.length > 0) {
      setForm((f) => ({ ...f, categoryId: cats.data[0].id }));
    }
  }, [mode, cats.data, form.categoryId]);

  // Edit mode: load the existing challenge.
  const loadQ = useQuery({
    queryKey: ['challenge-admin', challengeId],
    queryFn: () => getChallengeAdmin(challengeId!),
    enabled: mode === 'edit' && typeof challengeId === 'number',
    staleTime: 0,
  });

  useEffect(() => {
    if (mode !== 'edit' || !loadQ.data) return;
    const v = loadQ.data;
    setTitleSnapshot(v.title);
    setForm({
      categoryId: v.categoryId,
      title: v.title,
      description: v.description,
      baseScore: v.baseScore,
      minScore: v.minScore,
      decay: v.decay,
      difficulty: v.difficulty,
      status: v.status ?? (v.isPublished ? 'published' : 'draft'),
      isPublished: v.isPublished,
      connectionInfo: v.connectionInfo,
      tags: v.tags,
      isDynamic: v.isDynamic,
      image: v.image,
      internalPort: v.internalPort,
      protocol: v.protocol ?? 'tcp',
      sourceType: v.sourceType ?? 'image',
      buildContext: v.buildContext ?? '',
      defaultTtl: v.defaultTtl,
      memoryLimitMb: v.memoryLimitMb,
      cpuLimit: v.cpuLimit,
      pidsLimit: v.pidsLimit ?? 0,
      editorial: v.editorial ?? '',
      flags:
        v.flags && v.flags.length > 0
          ? v.flags.map((f) => ({
              type: f.type,
              content: f.content,
              caseSensitive: f.caseSensitive,
            }))
          : [{ type: 'static', content: '', caseSensitive: true }],
      accessGrants: v.accessGrants ?? [],
    });
    setAttachments(v.attachments ?? []);
  }, [mode, loadQ.data]);

  const createMut = useMutation({
    mutationFn: (input: ChallengeInput) => createChallenge(input),
    onSuccess: (created) => {
      toast.success('已创建');
      onCreated?.(created.id);
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '创建失败'),
  });

  const updateMut = useMutation({
    mutationFn: (input: ChallengeInput) => updateChallenge(challengeId!, input),
    onSuccess: () => {
      toast.success('已更新');
      onSaved?.();
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '更新失败'),
  });

  const uploadMut = useMutation({
    mutationFn: ({ id, file }: { id: number; file: File }) => uploadAttachment(id, file),
    onSuccess: (att) => {
      toast.success('上传成功');
      setAttachments((prev) => [...prev, att]);
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '上传失败'),
  });

  const deleteAttMut = useMutation({
    mutationFn: ({ cid, aid }: { cid: number; aid: number }) => deleteAttachment(cid, aid),
    onSuccess: (_, vars) => {
      toast.success('已删除附件');
      setAttachments((prev) => prev.filter((a) => a.id !== vars.aid));
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
    if (!form.categoryId) return toast.error('请选择分类');
    if (!form.title.trim()) return toast.error('请填写题目名称');
    if (form.isDynamic) {
      if (!(form.image ?? '').trim() && form.sourceType === 'image') {
        return toast.error('请填写容器镜像');
      }
      if (!form.internalPort || form.internalPort <= 0) {
        return toast.error('请填写容器内端口');
      }
    } else if (form.flags.some((f) => !f.content.trim())) {
      return toast.error('请完善所有 Flag 内容');
    }
    if (mode === 'edit') updateMut.mutate(form);
    else createMut.mutate(form);
  }

  const submitPending = createMut.isPending || updateMut.isPending;
  const editingId = mode === 'edit' ? challengeId : undefined;
  const headerLabel = mode === 'edit' ? `编辑：${titleSnapshot}` : '新建题目';

  // In edit mode, show a quiet loader until the existing challenge has been
  // loaded into the form. Prevents flashing EMPTY defaults on slow networks.
  if (mode === 'edit' && loadQ.isLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <FormHeader label={headerLabel} mode={mode} />

      <fieldset>
        <legend className="sr-only">题目类型</legend>
        <div className="grid sm:grid-cols-2 gap-3">
          {(['static', 'dynamic'] as const).map((t) => {
            const active = (t === 'dynamic') === form.isDynamic;
            return (
              <label
                key={t}
                className={cn(
                  'block border rounded-sm p-3 cursor-pointer transition-colors',
                  active
                    ? 'border-amber bg-paper-2'
                    : 'border-rule hover:border-rule-strong',
                )}
              >
                <input
                  type="radio"
                  name="challenge-type"
                  className="sr-only"
                  checked={active}
                  onChange={() => setForm((f) => ({ ...f, isDynamic: t === 'dynamic' }))}
                />
                <div className="text-sm font-medium">
                  {t === 'static' ? '静态题目' : '容器题目'}
                </div>
                <div className="text-2xs text-ink-3 mt-0.5">
                  {t === 'static'
                    ? '固定 flag，无需运行环境'
                    : 'Docker 实例 + 动态 flag 注入'}
                </div>
              </label>
            );
          })}
        </div>
      </fieldset>

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
            className={selectCls}
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

      <Field label="题解（解题后可见）" hint="支持 Markdown">
        <Textarea
          rows={5}
          value={form.editorial ?? ''}
          onChange={(e) => setForm((f) => ({ ...f, editorial: e.target.value }))}
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

      {!form.isDynamic && (
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
              <Plus className="h-3.5 w-3.5" />
              添加 Flag
            </Button>
          </div>
          {form.flags.map((fl, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <select
                className={`col-span-3 ${selectCls}`}
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
              <label className="col-span-1 flex items-center justify-center h-9 text-2xs text-ink-3 cursor-pointer">
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
          <p className="text-2xs text-ink-3">复选框表示大小写敏感。</p>
        </div>
      )}

      {form.isDynamic && (
        <div className="border border-rule bg-paper-2 p-4 space-y-3 rounded-sm">
          <div className="text-sm font-medium">容器运行环境</div>
          <div className="grid sm:grid-cols-2 gap-3 pt-1">
            <Field label="容器来源" hint="image=直接拉取镜像；dockerfile/compose=从源码构建">
              <select
                value={form.sourceType}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    sourceType: e.target.value as 'image' | 'dockerfile' | 'compose',
                  }))
                }
                className={selectCls}
              >
                <option value="image">Image（拉取现成镜像）</option>
                <option value="dockerfile">Dockerfile（上传构建上下文）</option>
                <option value="compose">Compose（多服务编排）</option>
              </select>
            </Field>
            {form.sourceType === 'image' ? (
              <Field label="镜像" hint="例如 nginx:alpine 或自建仓库地址">
                <Input
                  value={form.image}
                  onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
                  placeholder="registry/image:tag"
                />
              </Field>
            ) : (
              <Field
                label="Compose 服务名"
                hint={
                  form.sourceType === 'compose'
                    ? '暴露 internalPort 的服务名，默认 app'
                    : 'Dockerfile 模式可留空'
                }
              >
                <Input
                  value={form.buildContext}
                  onChange={(e) => setForm((f) => ({ ...f, buildContext: e.target.value }))}
                  placeholder={form.sourceType === 'compose' ? 'app' : ''}
                />
              </Field>
            )}
            <Field label="容器内端口">
              <Input
                type="number"
                value={form.internalPort}
                onChange={(e) =>
                  setForm((f) => ({ ...f, internalPort: Number(e.target.value) || 0 }))
                }
              />
            </Field>
            <Field label="连接协议" hint="决定前端展示成 nc 还是 http://">
              <select
                value={form.protocol}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    protocol: e.target.value as 'tcp' | 'http',
                  }))
                }
                className={selectCls}
              >
                <option value="tcp">TCP（nc host port）</option>
                <option value="http">HTTP（http://host:port）</option>
              </select>
            </Field>
            <Field label="默认 TTL（秒）" hint="不填使用全局默认 2 小时">
              <Input
                type="number"
                value={form.defaultTtl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, defaultTtl: Number(e.target.value) || 0 }))
                }
              />
            </Field>
            <Field label="内存上限（MB）">
              <Input
                type="number"
                value={form.memoryLimitMb}
                onChange={(e) =>
                  setForm((f) => ({ ...f, memoryLimitMb: Number(e.target.value) || 0 }))
                }
              />
            </Field>
            <Field label="CPU 核心数上限">
              <Input
                type="number"
                value={form.cpuLimit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, cpuLimit: Number(e.target.value) || 0 }))
                }
              />
            </Field>
            <Field label="进程数上限（pids）" hint="0 表示不限制">
              <Input
                type="number"
                value={form.pidsLimit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, pidsLimit: Number(e.target.value) || 0 }))
                }
              />
            </Field>
          </div>
        </div>
      )}

      {mode === 'edit' && editingId !== undefined && (
        <AttachmentManager
          challengeId={editingId}
          attachments={attachments}
          uploading={uploadMut.isPending}
          deleting={deleteAttMut.isPending}
          onUpload={(file) => uploadMut.mutate({ id: editingId, file })}
          onDelete={(aid) => deleteAttMut.mutate({ cid: editingId, aid })}
        />
      )}

      {mode === 'edit' && editingId !== undefined && form.isDynamic && form.sourceType !== 'image' && (
        <SourceFileManager challengeId={editingId} sourceType={form.sourceType} />
      )}

      {mode === 'edit' && editingId !== undefined && (
        <HintManager challengeId={editingId} />
      )}

      {canManageGrants && (
        <ChallengeAccessEditor
          grants={form.accessGrants ?? []}
          onChange={(next) => setForm((f) => ({ ...f, accessGrants: next }))}
        />
      )}

      <Field label="状态" hint="published 对所有人可见；hidden 仅对已授权对象可见">
        <select
          value={form.status}
          onChange={(e) =>
            setForm((f) => ({
              ...f,
              status: e.target.value as ChallengeInput['status'],
              isPublished: e.target.value === 'published',
            }))
          }
          className="h-9 px-2 bg-paper border border-rule rounded-sm text-sm"
        >
          <option value="draft">草稿</option>
          <option value="hidden">隐藏</option>
          <option value="published">已发布</option>
          <option value="archived">已归档</option>
        </select>
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" loading={submitPending} size="lg">
          {mode === 'edit' ? '保存修改' : '创建题目'}
        </Button>
        {mode === 'edit' && onSaved && (
          <Button type="button" variant="ghost" size="lg" onClick={onSaved}>
            完成编辑
          </Button>
        )}
      </div>
    </form>
  );
}

function FormHeader({ label, mode }: { label: string; mode: 'create' | 'edit' }) {
  return (
    <div className="border-b border-rule pb-2">
      <p className="font-mono text-2xs text-ink-3 mb-1 tabular-nums">
        {mode === 'edit'
          ? '$ sudo admin edit-challenge'
          : '$ sudo admin new-challenge'}
      </p>
      <h1 className="text-2xl font-semibold tracking-tightest text-ink leading-tight">
        {label}
      </h1>
    </div>
  );
}
