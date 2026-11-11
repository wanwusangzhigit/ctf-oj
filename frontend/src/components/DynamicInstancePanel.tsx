import i18n from '@/locales/i18n';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Copy,
  ExternalLink,
  Play,
  RefreshCw,
  RotateCw,
  Server,
  Trash2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  startInstance,
  restartInstance,
  getActiveInstance,
  extendInstance,
  stopInstance,
} from '@/api/instance';
import { ApiClientError } from '@/api/client';
import { relativeTime, formatDuration } from '@/lib/utils';
import type { ChallengeProtocol, Instance } from '@/types';

export function DynamicInstancePanel({
  challengeId,
  competitionId,
  protocol,
  solved,
  onSolvedRefresh,
}: {
  challengeId: number;
  competitionId?: number;
  protocol: ChallengeProtocol;
  solved: boolean;
  onSolvedRefresh?: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const instanceKey = ['active-instance', challengeId, competitionId ?? 0] as const;

  const query = useQuery({
    queryKey: instanceKey,
    queryFn: () => getActiveInstance(challengeId, competitionId),
    retry: false,
    refetchInterval(query) {
      return query.state.data?.status === 'running' ? 30_000 : false;
    },
  });

  const startMut = useMutation({
    mutationFn: () => startInstance(challengeId, competitionId),
    onSuccess: (res) => {
      toast.success(i18n.t('实例已启动'));
      qc.setQueryData(instanceKey, res.instance);
      onSolvedRefresh?.();
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('启动失败'));
    },
  });

  const restartMut = useMutation({
    mutationFn: () => restartInstance(challengeId, competitionId),
    onSuccess: (res) => {
      toast.success(i18n.t('实例已重启，新 Flag 已生成'));
      qc.setQueryData(instanceKey, res.instance);
      onSolvedRefresh?.();
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('重启失败')),
  });

  const extendMut = useMutation({
    mutationFn: (id: number) => extendInstance(challengeId, id, 3600),
    onSuccess: (inst) => {
      toast.success(i18n.t('已延长 1 小时'));
      qc.setQueryData(instanceKey, inst);
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('延长失败')),
  });

  const stopMut = useMutation({
    mutationFn: (id: number) => stopInstance(challengeId, id),
    onSuccess: () => {
      toast.success(i18n.t('实例已销毁'));
      qc.setQueryData(instanceKey, null);
      qc.invalidateQueries({ queryKey: instanceKey });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('销毁失败')),
  });

  useEffect(() => {
    if (query.data?.status !== 'running') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [query.data?.status]);

  const inst: Instance | null = query.data ?? null;
  const isLoading = query.isLoading && !query.isError;
  const notRunning = query.isError || inst === null;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>{i18n.t('实例')}</CardTitle>
        {inst?.status === 'running' && <Badge tone="success">{i18n.t('运行中')}</Badge>}
      </CardHeader>
      <CardBody className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Spinner className="h-5 w-5 text-muted" />
          </div>
        ) : notRunning ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {i18n.t('这是一道容器化题目。启动后将获得专属实例并分配独立端口；运行时限默认 2 小时，到期自动销毁。')}
            </p>
            <Button
              className="w-full"
              onClick={() => startMut.mutate()}
              loading={startMut.isPending}
            >
              <Play className="h-3.5 w-3.5" />
              {solved ? i18n.t('重新启动实例') : i18n.t('启动实例')}
            </Button>
            {solved && (
              <p className="text-2xs text-muted">
                {i18n.t('本题已通过。重新启动会生成新的专属 Flag，可继续练习或重做。')}
              </p>
            )}
          </div>
        ) : (
          <RunningView
            inst={inst!}
            protocol={protocol}
            now={now}
            solved={solved}
            onExtend={() => extendMut.mutate(inst!.id)}
            onRestart={async () => {
              const ok = await confirm({
                title: i18n.t('重启实例'),
                description: i18n.t('旧 Flag 将失效，新 Flag 会自动注入。'),
                confirmText: i18n.t('重启'),
                danger: false,
              });
              if (ok) restartMut.mutate();
            }}
            onStop={async () => {
              const ok = await confirm({
                title: i18n.t('销毁实例'),
                description: i18n.t('容器会立即停止，未提交的 Flag 将丢失。'),
                confirmText: i18n.t('销毁'),
              });
              if (ok) stopMut.mutate(inst!.id);
            }}
            extending={extendMut.isPending}
            restarting={restartMut.isPending}
            stopping={stopMut.isPending}
          />
        )}
      </CardBody>
    </Card>
  );
}

function RunningView({
  inst,
  protocol,
  now,
  solved,
  onExtend,
  onRestart,
  onStop,
  extending,
  restarting,
  stopping,
}: {
  inst: Instance;
  protocol: ChallengeProtocol;
  now: number;
  solved: boolean;
  onExtend: () => void;
  onRestart: () => void;
  onStop: () => void;
  extending: boolean;
  restarting: boolean;
  stopping: boolean;
}) {
  const toast = useToast();
  const connection = inst.connection || `${inst.host}:${inst.port}`;
  const remainingMs = useMemo(
    () => new Date(inst.expiresAt).getTime() - now,
    [inst.expiresAt, now],
  );
  const isHTTP = protocol === 'http';
  const httpURL = connection.startsWith('http') ? connection : `http://${connection}`;
  const displayCmd = isHTTP ? httpURL : connection;
  const openURL = httpURL;
  const expired = remainingMs <= 0;

  const copyConnection = () => {
    if (!navigator.clipboard) return;
    navigator.clipboard
      .writeText(displayCmd)
      .then(() => toast.success(i18n.t('已复制连接信息')))
      .catch(() => toast.error(i18n.t('复制失败')));
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-surface-2 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Server className="h-3.5 w-3.5 text-muted shrink-0" />
            <span className="font-mono text-sm truncate">{displayCmd}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {isHTTP && (
              <a
                href={openURL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={i18n.t('打开实例')}
                title={i18n.t('在新标签页打开')}
                className="inline-flex items-center justify-center h-7 w-7 rounded text-muted hover:text-accent hover:bg-surface transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              type="button"
              aria-label={i18n.t('复制连接信息')}
              title={i18n.t('复制')}
              onClick={copyConnection}
              className="inline-flex items-center justify-center h-7 w-7 rounded text-muted hover:text-fg hover:bg-surface transition-colors"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-1 text-2xs text-muted">
          <dt>{i18n.t('协议')}</dt>
          <dd className="font-mono">{isHTTP ? 'HTTP' : 'TCP'}</dd>
          <dt>{i18n.t('镜像')}</dt>
          <dd className="font-mono truncate">{inst.image}</dd>
          <dt>{i18n.t('剩余时长')}</dt>
          <dd className={expired ? 'text-danger font-medium' : 'font-medium'}>
            {expired ? i18n.t('已过期') : formatDuration(remainingMs)}
          </dd>
          <dt>{i18n.t('启动')}</dt>
          <dd>{relativeTime(inst.startedAt)}</dd>
        </dl>
      </div>

      {isHTTP && !expired && (
        <a
          href={openURL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 h-9 px-4 w-full rounded-md bg-accent text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {i18n.t('打开实例页面')}
        </a>
      )}

      {!solved && (
        <p className="text-2xs text-muted">
          {i18n.t('提交专属动态 Flag 即可解题。Flag 已生成并通过环境变量注入到你的实例中。')}
        </p>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" onClick={onExtend} loading={extending} disabled={expired}>
          <RefreshCw className="h-3.5 w-3.5" />
          {i18n.t('延长')}
        </Button>
        <Button variant="outline" onClick={onRestart} loading={restarting}>
          <RotateCw className="h-3.5 w-3.5" />
          {i18n.t('重启')}
        </Button>
        <Button variant="danger" onClick={onStop} loading={stopping}>
          <Trash2 className="h-3.5 w-3.5" />
          {i18n.t('销毁')}
        </Button>
      </div>
    </div>
  );
}
