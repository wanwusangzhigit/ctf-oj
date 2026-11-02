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
  if (d > 0) return `${d} 天 ${h} 小时`;
  if (h > 0) return `${h} 小时 ${m} 分`;
  return `${m} 分 ${s % 60} 秒`;
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
      toast.success(r.output || '已清理停止的容器');
      qc.invalidateQueries({ queryKey: ['admin-server'] });
    },
    onError: () => toast.error('清理失败'),
  });

  if (q.isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }
  if (!q.data) {
    return <p className="py-10 text-sm text-ink-3">无法读取服务器状态。</p>;
  }

  const { host, runtime, dependencies, counts, docker, containers } = q.data;
  const memUsed = host.memTotal - host.memAvailable;
  const diskUsed = host.diskTotal - host.diskFree;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-t-2 border-ink pt-6">
        <div>
          <p className="mb-3 font-mono text-2xs text-ink-3">$ systemctl status ctf-oj</p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">服务器</h2>
          <p className="mt-1 max-w-prose text-sm text-ink-3">
            主机资源、运行时依赖与题目容器的实时状态，每 15 秒刷新。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-2xs text-ink-3">
            更新于 {formatTime(q.data.generatedAt)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? 'animate-spin' : ''}`} />
            刷新
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4" /> 主机
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 text-sm">
            <p className="font-mono text-ink">{host.hostname}</p>
            <p className="text-ink-3">
              {host.os}/{host.arch} · {host.kernel || '未知内核'}
            </p>
            <p className="text-ink-3">运行 {duration(host.uptimeSeconds)}</p>
            <p className="font-mono text-2xs text-ink-3">
              load {host.load1.toFixed(2)} / {host.load5.toFixed(2)} / {host.load15.toFixed(2)} ·{' '}
              {host.cpus} 核
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <MemoryStick className="h-4 w-4" /> 内存
            </CardTitle>
          </CardHeader>
          <CardBody>
            <Meter label="MEM" used={memUsed} total={host.memTotal} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <HardDrive className="h-4 w-4" /> 磁盘
            </CardTitle>
          </CardHeader>
          <CardBody>
            <Meter label="/" used={diskUsed} total={host.diskTotal} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Cpu className="h-4 w-4" /> 运行时
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-1 text-sm text-ink-3">
            <p className="font-mono text-ink">{runtime.goVersion}</p>
            <p>goroutine {runtime.goroutines}</p>
            <p>堆 {formatBytes(runtime.heapAlloc)} · 系统 {formatBytes(runtime.sys)}</p>
            <p>GC {runtime.numGC} 次 · 已运行 {duration(runtime.uptimeSeconds)}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">依赖状态</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {dependencies.map((dep) => (
              <div key={dep.name} className="flex items-start justify-between gap-4 border-b border-rule pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-mono text-sm text-ink">{dep.name}</p>
                  <p className="mt-0.5 break-all text-2xs text-ink-3">
                    {dep.detail || (dep.status === 'up' ? '连接正常' : '不可用')}
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
            <CardTitle className="text-sm">数据概览</CardTitle>
          </CardHeader>
          <CardBody className="grid grid-cols-3 gap-4">
            <Stat label="用户" value={counts.users} />
            <Stat label="题目" value={counts.challenges} />
            <Stat label="提交" value={counts.submissions} />
            <Stat label="实例" value={counts.instances} />
            <Stat label="团队" value={counts.teams} />
            <Stat label="容器" value={`${docker.containersRunning}/${docker.containersTotal}`} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-sm">
            题目容器
            <span className="ml-2 font-mono text-2xs font-normal text-ink-3">
              {docker.available ? `docker ${docker.version || 'unknown'}` : 'docker 不可用'}
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            disabled={pruneMut.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: '清理停止容器',
                description: '所有已停止的题目容器会被删除，运行中的容器不受影响。',
                confirmText: '清理',
                danger: false,
              });
              if (ok) pruneMut.mutate();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" /> 清理停止容器
          </Button>
        </CardHeader>
        <CardBody>
          {docker.error && <p className="mb-3 text-2xs text-danger">{docker.error}</p>}
          {containers.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">没有由本站托管的容器。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-2 text-2xs uppercase text-muted">
                    <th className="px-3 py-2 text-left font-medium">容器</th>
                    <th className="px-3 py-2 text-left font-medium">镜像</th>
                    <th className="px-3 py-2 text-left font-medium">状态</th>
                    <th className="px-3 py-2 text-left font-medium">端口</th>
                    <th className="px-3 py-2 text-left font-medium">创建</th>
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
