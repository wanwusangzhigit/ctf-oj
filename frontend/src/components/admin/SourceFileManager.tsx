import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileCode, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button, Field, Input, Textarea, useConfirm, useToast } from '@/components/ui';
import {
  deleteSource,
  downloadSourceBlob,
  getSourceText,
  listSources,
  uploadSource,
  uploadSourceText,
} from '@/api/challenge';
import { ApiClientError } from '@/api/client';
import { formatBytes } from '@/lib/utils';

type SourceType = 'dockerfile' | 'compose';

const SOURCE_TEMPLATES: Record<SourceType, { path: string; content: string }> = {
  dockerfile: {
    path: 'Dockerfile',
    content: `FROM python:3.11-slim

WORKDIR /app
COPY . /app

# 启动时由后端注入 FLAG 与 PUBLISHED_PORT 环境变量
RUN pip install --no-cache-dir flask gunicorn

EXPOSE 8080
CMD ["gunicorn", "-b", "0.0.0.0:8080", "app:app"]
`,
  },
  compose: {
    path: 'docker-compose.yml',
    content: `services:
  app:
    build: .
    # 后端会注入 PUBLISHED_PORT 环境变量用于端口映射
    ports:
      - "\${PUBLISHED_PORT}:8080"
    environment:
      FLAG: "\${FLAG}"
      INSTANCE_ID: "\${INSTANCE_ID}"
`,
  },
};

function trimTrailingSlash(s: string): string {
  return s.replace(/\s+$/, '');
}

/**
 * SourceFileManager — manage the Dockerfile / docker-compose build context
 * for a dynamic challenge. Only rendered for admin users editing an existing
 * challenge whose sourceType is dockerfile or compose.
 */
export function SourceFileManager({
  challengeId,
  sourceType,
}: {
  challengeId: number;
  sourceType: SourceType;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [editorPath, setEditorPath] = useState<string>('');
  const [editorContent, setEditorContent] = useState<string>('');

  const sourcesQ = useQuery({
    queryKey: ['challenge-sources', challengeId],
    queryFn: () => listSources(challengeId),
    enabled: challengeId > 0,
  });

  const uploadFileMut = useMutation({
    mutationFn: ({ path, file }: { path: string; file: File }) =>
      uploadSource(challengeId, path, file),
    onSuccess: () => {
      toast.success('已上传');
      qc.invalidateQueries({ queryKey: ['challenge-sources', challengeId] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '上传失败'),
  });

  const uploadTextMut = useMutation({
    mutationFn: ({ path, content }: { path: string; content: string }) =>
      uploadSourceText(challengeId, path, content),
    onSuccess: () => {
      toast.success('已保存');
      qc.invalidateQueries({ queryKey: ['challenge-sources', challengeId] });
      setEditorPath('');
      setEditorContent('');
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '保存失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (path: string) => deleteSource(challengeId, path),
    onSuccess: () => {
      toast.success('已删除');
      qc.invalidateQueries({ queryKey: ['challenge-sources', challengeId] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '删除失败'),
  });

  const entries = sourcesQ.data ?? [];
  const hasTemplate =
    entries.some((e) => e.path === 'Dockerfile') ||
    entries.some((e) => e.path === 'docker-compose.yml');

  function applyTemplate() {
    const tpl = SOURCE_TEMPLATES[sourceType];
    setEditorPath(tpl.path);
    setEditorContent(tpl.content);
  }

  function triggerDownload(path: string) {
    downloadSourceBlob(challengeId, path)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = path.split('/').pop() || 'download';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      })
      .catch(() => toast.error('下载失败'));
  }

  return (
    <div className="border border-rule bg-paper-2 p-4 space-y-3 rounded-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium inline-flex items-center gap-1.5">
          <FileCode className="h-3.5 w-3.5 text-amber" />
          容器构建源（{sourceType === 'dockerfile' ? 'Dockerfile' : 'docker compose'}）
        </span>
        <div className="flex items-center gap-1.5">
          {!hasTemplate && (
            <Button variant="ghost" size="sm" onClick={applyTemplate}>
              <Plus className="h-3.5 w-3.5" />
              使用模板
            </Button>
          )}
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                for (const f of files) {
                  uploadFileMut.mutate({ path: f.name, file: f });
                }
                e.target.value = '';
              }}
            />
            <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm border border-rule-strong text-2xs font-medium hover:bg-paper transition-colors">
              <Upload className="h-3 w-3" />
              上传文件
            </span>
          </label>
        </div>
      </div>

      <p className="text-2xs text-ink-3 leading-relaxed">
        {sourceType === 'dockerfile'
          ? '需上传名为 Dockerfile 的文件。启动实例时执行 docker build 并注入 FLAG / PUBLISHED_PORT 环境变量。'
          : '需上传名为 docker-compose.yml 的文件；其中 ports 用 ${PUBLISHED_PORT} 占位，FLAG 由后端自动注入。要求含名为 app 的服务暴露 internalPort。'}
      </p>

      {entries.length > 0 && (
        <ul className="border-t border-rule">
          {entries.map((e) => (
            <li
              key={e.path}
              className="grid grid-cols-[1fr_auto] gap-x-3 items-center py-2 border-b border-rule last:border-b-0"
            >
              <button
                type="button"
                onClick={() => triggerDownload(e.path)}
                className="inline-flex items-center gap-2 min-w-0 text-left font-mono text-2xs hover:text-amber transition-colors"
              >
                <Download className="h-3 w-3 shrink-0" />
                <span className="truncate text-ink">{e.path}</span>
                <span className="text-ink-3 shrink-0 tabular-nums">
                  ({formatBytes(e.size)})
                </span>
              </button>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditorPath(e.path);
                    getSourceText(challengeId, e.path)
                      .then(setEditorContent)
                      .catch(() => toast.error('加载失败'));
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  编辑
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  loading={deleteMut.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: '删除源码文件',
                      description: `删除「${e.path}」？容器镜像重新构建后不会再包含该文件。`,
                      confirmText: '删除',
                    });
                    if (ok) deleteMut.mutate(e.path);
                  }}
                  aria-label="删除"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editorPath && (
        <div className="space-y-2 pt-3 border-t border-rule">
          <div className="flex items-center justify-between gap-2">
            <Field>
              <Input
                value={editorPath}
                onChange={(e) => setEditorPath(e.target.value)}
                placeholder="相对路径，例如 src/index.py"
                className="font-mono text-2xs"
              />
            </Field>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setEditorPath('');
                setEditorContent('');
              }}
              aria-label="取消"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Textarea
            rows={12}
            value={trimTrailingSlash(editorContent)}
            onChange={(e) => setEditorContent(e.target.value)}
            className="font-mono text-2xs"
            placeholder="文件内容…"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              loading={uploadTextMut.isPending}
              disabled={!editorPath.trim()}
              onClick={() => uploadTextMut.mutate({ path: editorPath, content: editorContent })}
            >
              保存到容器源
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Upload(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
