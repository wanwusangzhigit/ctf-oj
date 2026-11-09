import i18n from '@/locales/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, HardDrive, MemoryStick, RefreshCw, Server, Trash2 } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, Spinner, useConfirm, useToast } from '@/components/ui';
import { getServerOverview, pruneServerContainers } from '@/api/admin';
import { formatBytes, formatTime } from '@/lib/utils';

function duration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return i18n.t('{{v0}} 天 {{v1}} 小时', { v0: d, v1: h });
  if (h > 0) return i18n.t('{{v0}} 小时 {{v1}} 分', { v0: h, v1: m });
  return i18n.t('{{v0}} 分 {{v1}} 秒', { v0: m, v1: s % 60 });
}

function Meter({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-2xs font-mono text-ink-3">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full bg-surface-2">
        <div
          className={pct >= 90 ? 'h-full bg-danger' : 'h-full bg-accent'}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-2xs text-ink-3">
        {formatBytes(used)} / {formatBytes(total)}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border-l border-rule pl-3">
      <p className="text-2xs uppercase text-muted">{label}</p>
      <p className="mt-1 font-mono text-lg text-ink">{value}</p>
    </div>
  );
}

export function AdminServerPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ['admin-server'],
    queryFn: getServerOverview,
    refetchInterval: 15_000,
  });
  const pruneMut = useMutation({
    mutationFn: pruneServerContainers,
    onSuccess: (r) => {
      toast.success(r.output || i18n.t('已清理停止的容器'));
      qc.invalidateQueries({ queryKey: ['admin-server'] });
    },
    onError: () => toast.error(i18n.t('清理失败')),
  });

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (!q.data) {
    return <p className="py-10 text-sm text-ink-3">{i18n.t('无法读取服务器状态。')}</p>;
  }

  const { host, runtime, dependencies, counts, docker, containers } = q.data;
  const memUsed = host.memTotal - host.memAvailable;
  const diskUsed = host.diskTotal - host.diskFree;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-t-2 border-ink pt-6">
        <div>
          <p className="mb-3 font-mono text-2xs text-ink-3">$ systemctl status ctf-oj</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">{i18n.t('服务器')}</h2>
          <p className="mt-1 max-w-prose text-sm text-ink-3">
            {i18n.t('主机资源、运行时依赖与题目容器的实时状态，每 15 秒刷新。')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs text-ink-3">{i18n.t('更新于 {{v0}}', { v0: formatTime(q.data.generatedAt) })}</span>
          <Button variant="ghost" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
            {i18n.t('刷新')}
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4" /> {i18n.t('主机')}
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <p className="font-mono text-ink">{host.hostname}</p>
            <p className="text-ink-3">
              {host.os}/{host.arch} · {host.kernel || i18n.t('未知内核')}
            </p>
            <p className="text-ink-3">{i18n.t('运行 {{v0}}', { v0: duration(host.uptimeSeconds) })}</p>
            <p className="font-mono text-2xs text-ink-3">{i18n.t('load {{v0}} / {{v1}} / {{v2}} ·{{v3}} {{v4}} 核', { v0: host.load1.toFixed(2), v1: host.load5.toFixed(2), v2: host.load15.toFixed(2), v3: ' ', v4: host.cpus })}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MemoryStick className="h-4 w-4" /> {i18n.t('内存')}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <Meter label="MEM" used={memUsed} total={host.memTotal} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <HardDrive className="h-4 w-4" /> {i18n.t('磁盘')}
            </CardTitle>
          </CardHeader>
          <CardBody>
            <Meter label="/" used={diskUsed} total={host.diskTotal} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4" /> {i18n.t('运行时')}
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-1 text-sm text-ink-3">
            <p className="font-mono text-ink">{runtime.goVersion}</p>
            <p>goroutine {runtime.goroutines}</p>
            <p>{i18n.t('堆 {{v0}} · 系统 {{v1}}', { v0: formatBytes(runtime.heapAlloc), v1: formatBytes(runtime.sys) })}</p>
            <p>{i18n.t('GC {{v0}} 次 · 已运行 {{v1}}', { v0: runtime.numGC, v1: duration(runtime.uptimeSeconds) })}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{i18n.t('依赖状态')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {dependencies.map((dep) => (
              <div key={dep.name} className="flex items-start justify-between gap-4 border-b border-rule pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-mono text-sm text-ink">{dep.name}</p>
                  <p className="mt-0.5 break-all text-2xs text-ink-3">
                    {dep.detail || (dep.status === 'up' ? i18n.t('连接正常') : i18n.t('不可用'))}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {dep.latencyMs > 0 && (
                    <span className="font-mono text-2xs text-ink-3">{dep.latencyMs}ms</span>
                  )}
                  <Badge tone={dep.status === 'up' ? 'success' : 'danger'}>{dep.status}</Badge>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">{i18n.t('数据概览')}</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-3 gap-4">
            <Stat label={i18n.t('用户')} value={counts.users} />
            <Stat label={i18n.t('题目')} value={counts.challenges} />
            <Stat label={i18n.t('提交')} value={counts.submissions} />
            <Stat label={i18n.t('实例')} value={counts.instances} />
            <Stat label={i18n.t('团队')} value={counts.teams} />
            <Stat label={i18n.t('容器')} value={`${docker.containersRunning}/${docker.containersTotal}`} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm">
            {i18n.t('题目容器')}
            <span className="ml-2 font-mono text-2xs font-normal text-ink-3">
              {docker.available ? `docker ${docker.version || 'unknown'}` : i18n.t('docker 不可用')}
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            disabled={pruneMut.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: i18n.t('清理停止容器'),
                description: i18n.t('所有已停止的题目容器会被删除，运行中的容器不受影响。'),
                confirmText: i18n.t('清理'),
                danger: false,
              });
              if (ok) pruneMut.mutate();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> {i18n.t('清理停止容器')}
          </Button>
        </CardHeader>
        <CardBody>
          {docker.error && <p className="mb-3 text-2xs text-danger">{docker.error}</p>}
          {containers.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">{i18n.t('没有由本站托管的容器。')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-2xs uppercase text-muted">
                    <th className="px-3 py-2 text-left font-medium">{i18n.t('容器')}</th>
                    <th className="px-3 py-2 text-left font-medium">{i18n.t('镜像')}</th>
                    <th className="px-3 py-2 text-left font-medium">{i18n.t('状态')}</th>
                    <th className="px-3 py-2 text-left font-medium">{i18n.t('端口')}</th>
                    <th className="px-3 py-2 text-left font-medium">{i18n.t('创建')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {containers.map((c) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-mono text-2xs text-ink">{c.name}</td>
                      <td className="px-3 py-2 font-mono text-2xs text-ink-3">{c.image}</td>
                      <td className="px-3 py-2">
                        <Badge tone={c.state === 'running' ? 'success' : 'neutral'}>
                          {c.state}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 font-mono text-2xs text-ink-3">{c.ports || '—'}</td>
                      <td className="px-3 py-2 text-2xs text-ink-3">{c.createdAt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
