import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Trash2, Play, ExternalLink, Server } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  useToast,
} from '@/components/ui';
import {
  startInstance,
  getActiveInstance,
  extendInstance,
  stopInstance,
} from '@/api/instance';
import { ApiClientError } from '@/api/client';
import { relativeTime } from '@/lib/utils';
import type { Instance } from '@/types';

export function DynamicInstancePanel({
  challengeId,
  solved,
  onSolvedRefresh,
}: {
  challengeId: number;
  solved: boolean;
  onSolvedRefresh?: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [flagCopied, setFlagCopied] = useState(false);

  const query = useQuery({
    queryKey: ['active-instance', challengeId],
    queryFn: () => getActiveInstance(challengeId),
    retry: false,
    refetchInterval(query) {
      return query.state.data?.status === 'running' ? 30_000 : false;
    },
  });

  const startMut = useMutation({
    mutationFn: () => startInstance(challengeId),
    onSuccess: (res) => {
      toast.success('实例已启动');
      qc.setQueryData(['active-instance', challengeId], res.instance);
      onSolvedRefresh?.();
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : '启动失败');
    },
  });

  const extendMut = useMutation({
    mutationFn: (id: number) => extendInstance(challengeId, id, 3600),
    onSuccess: (inst) => {
      toast.success('已延长 1 小时');
      qc.setQueryData(['active-instance', challengeId], inst);
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '延长失败'),
  });

  const stopMut = useMutation({
    mutationFn: (id: number) => stopInstance(challengeId, id),
    onSuccess: () => {
      toast.success('实例已销毁');
      qc.setQueryData(['active-instance', challengeId], null);
      qc.invalidateQueries({ queryKey: ['active-instance', challengeId] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '销毁失败'),
  });

  useEffect(() => {
    if (!flagCopied) return;
    const t = setTimeout(() => setFlagCopied(false), 1500);
    return () => clearTimeout(t);
  }, [flagCopied]);

  const inst: Instance | null = query.data ?? null;
  const isLoading = query.isLoading && !query.isError;
  const notRunning = query.isError || inst === null;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>实例</CardTitle>
        {inst?.status === 'running' && <Badge tone="success">运行中</Badge>}
      </CardHeader>
      <CardBody className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner className="h-5 w-5 text-muted" />
          </div>
        ) : notRunning ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              这是一道容器化题目。启动后将获得专属实例并分配独立端口；运行时限默认 2 小时，到期自动销毁。
            </p>
            <Button
              className="w-full"
              onClick={() => startMut.mutate()}
              loading={startMut.isPending}
              disabled={solved}
            >
              <Play className="h-3.5 w-3.5" />
              {solved ? '已通过，无需启动' : '启动实例'}
            </Button>
          </div>
        ) : (
          <RunningView
            inst={inst!}
            solved={solved}
            onExtend={() => extendMut.mutate(inst!.id)}
            onStop={() => {
              if (confirm('确认销毁该实例？未提交的 Flag 将丢失。')) stopMut.mutate(inst!.id);
            }}
            extending={extendMut.isPending}
            stopping={stopMut.isPending}
            onCopyFlag={() => {
              if (inst?.challengeId && navigator.clipboard) {
                navigator.clipboard.writeText('');
              }
            }}
          />
        )}
      </CardBody>
    </Card>
  );
}

function RunningView({
  inst,
  solved,
  onExtend,
  onStop,
  extending,
  stopping,
}: {
  inst: Instance;
  solved: boolean;
  onExtend: () => void;
  onStop: () => void;
  extending: boolean;
  stopping: boolean;
  onCopyFlag: () => void;
}) {
  const connection = `${inst.host}:${inst.port}`;
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="h-3.5 w-3.5 text-muted shrink-0" />
            <span className="font-mono text-sm truncate">{connection}</span>
          </div>
          <button
            type="button"
            aria-label="copy connection"
            className="text-muted hover:text-fg"
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(connection);
              }
            }}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-1 text-2xs text-muted">
          <dt>镜像</dt>
          <dd className="font-mono truncate">{inst.image}</dd>
          <dt>到期</dt>
          <dd>{relativeTime(inst.expiresAt)}</dd>
          <dt>启动</dt>
          <dd>{relativeTime(inst.startedAt)}</dd>
        </dl>
      </div>

      {!solved && (
        <p className="text-2xs text-muted">
          提交专属动态 Flag 即可解题。Flag 已生成并通过环境变量注入到你的实例中。
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onExtend} loading={extending}>
          <RefreshCw className="h-3.5 w-3.5" />
          延长 1 小时
        </Button>
        <Button variant="danger" onClick={onStop} loading={stopping}>
          <Trash2 className="h-3.5 w-3.5" />
          销毁实例
        </Button>
      </div>
    </div>
  );
}
