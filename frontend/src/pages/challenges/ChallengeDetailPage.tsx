import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  Paperclip,
  Server,
} from 'lucide-react';
import { getChallenge, submitFlag, attachmentDownloadURL } from '@/api/challenge';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Spinner,
  useToast,
} from '@/components/ui';
import { formatBytes, formatTime, relativeTime } from '@/lib/utils';
import { ApiClientError } from '@/api/client';

export function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const challengeId = Number(id);
  const toast = useToast();
  const qc = useQueryClient();
  const [flag, setFlag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['challenge', challengeId],
    queryFn: () => getChallenge(challengeId),
    enabled: !Number.isNaN(challengeId),
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">
            题目不存在或已下线。
            <div className="mt-3">
              <Link to="/challenges" className="text-accent">
                返回列表
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flag.trim()) return;
    setSubmitting(true);
    try {
      const res = await submitFlag(challengeId, flag.trim());
      if (res.correct) {
        toast.success(`Accepted · +${res.score}`);
        qc.invalidateQueries({ queryKey: ['challenge', challengeId] });
        qc.invalidateQueries({ queryKey: ['challenges'] });
        setFlag('');
      } else {
        toast.error(res.message || 'Flag 错误');
      }
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : '提交失败';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <Link
        to="/challenges"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg mb-4"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回列表
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge tone="neutral">{data.category?.name ?? '未分类'}</Badge>
          {data.solved && (
            <Badge tone="success">
              <CheckCircle2 className="h-3 w-3" />
              已解
            </Badge>
          )}
          <Badge tone="neutral">{data.solveCount} 人已解</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-muted">
          <span>基础分 {data.baseScore}</span>
          <span>·</span>
          <span>最低分 {data.minScore}</span>
          <span>·</span>
          <span>难度 {data.difficulty}/5</span>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>题目描述</CardTitle>
            </CardHeader>
            <CardBody>
              {data.description ? (
                <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-fg">
                  {data.description}
                </div>
              ) : (
                <div className="text-sm text-muted">这道题没有描述，请尝试从附件或连接信息入手。</div>
              )}
            </CardBody>
          </Card>

          {data.attachments?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>附件</CardTitle>
              </CardHeader>
              <CardBody className="p-0">
                <ul className="divide-y divide-border">
                  {data.attachments.map((a) => (
                    <li key={a.id} className="px-5 py-3 flex items-center gap-3">
                      <Paperclip className="h-4 w-4 text-muted" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{a.filename}</div>
                        <div className="text-2xs text-muted">
                          {formatBytes(a.size)} · {formatTime(a.createdAt)}
                        </div>
                      </div>
                      <a
                        href={attachmentDownloadURL(data.id, a.id)}
                        className="inline-flex items-center gap-1 h-8 px-2.5 text-sm rounded border border-border hover:bg-surface-2"
                      >
                        <Download className="h-3.5 w-3.5" />
                        下载
                      </a>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>提交 Flag</CardTitle>
            </CardHeader>
            <CardBody>
              <form onSubmit={onSubmit} className="space-y-3">
                <Input
                  value={flag}
                  onChange={(e) => setFlag(e.target.value)}
                  placeholder="flag{...}"
                  className="font-mono"
                  disabled={data.solved}
                />
                <Button
                  type="submit"
                  loading={submitting}
                  className="w-full"
                  disabled={data.solved}
                >
                  {data.solved ? '已通过' : '提交'}
                </Button>
              </form>
            </CardBody>
          </Card>

          {data.connectionInfo && (
            <Card>
              <CardHeader>
                <CardTitle>连接信息</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="flex items-center gap-2 font-mono text-sm text-fg bg-surface-2 px-3 py-2 rounded">
                  <Server className="h-3.5 w-3.5 text-muted" />
                  <span className="flex-1 truncate">{data.connectionInfo}</span>
                  <button
                    type="button"
                    aria-label="copy"
                    className="text-muted hover:text-fg"
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(data.connectionInfo)
                        .then(() => toast.success('已复制到剪贴板'));
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>题目信息</CardTitle>
            </CardHeader>
            <CardBody>
              <dl className="space-y-2 text-sm">
                <Row label="分类">{data.category?.name ?? '—'}</Row>
                <Row label="创建时间">{relativeTime(data.createdAt)}</Row>
                <Row label="标签">{data.tags || '—'}</Row>
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-right truncate max-w-[60%]">{children}</dd>
    </div>
  );
}
