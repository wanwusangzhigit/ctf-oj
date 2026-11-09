import i18n from '@/locales/i18n';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileText, Upload, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Modal,
  Spinner,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  adminListInstances,
  adminStopInstance,
  adminInstanceLogs,
  exportChallenges,
} from '@/api/admin';
import { client } from '@/api/client';
import { ApiClientError } from '@/api/client';
import { formatTime } from '@/lib/utils';
import type { Instance } from '@/types';

const PAGE_SIZE = 50;

export function AdminOverviewPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [logsTarget, setLogsTarget] = useState<{ id: number; title: string } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const list = useQuery({
    queryKey: ['admin-instances', status, page],
    queryFn: () =>
      adminListInstances(page, PAGE_SIZE, status ? { status } : undefined),
    staleTime: 15_000,
  });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const stopMut = useMutation({
    mutationFn: (id: number) => adminStopInstance(id),
    onSuccess: () => {
      toast.success(i18n.t('实例已销毁'));
      qc.invalidateQueries({ queryKey: ['admin-instances'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('销毁失败')),
  });

  const stopId = stopMut.isPending ? stopMut.variables : undefined;

  const openLogs = (inst: Instance) =>
    setLogsTarget({
      id: inst.id,
      title: inst.challenge?.title ?? `#${inst.challengeId}`,
    });

  const stopInstance = async (inst: Instance) => {
    const title = inst.challenge?.title ?? `#${inst.challengeId}`;
    const ok = await confirm({
      title: i18n.t('强制销毁实例'),
      description: i18n.t('「{{v0}}」的运行容器会被立即停止并删除。', { v0: title }),
      confirmText: i18n.t('销毁'),
    });
    if (ok) stopMut.mutate(inst.id);
  };

  const exportMut = useMutation({
    mutationFn: () => exportChallenges(),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ctfoj-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(i18n.t('导出完成'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : i18n.t('导出失败')),
  });

  const importMut = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append('file', file);
      const resp = await client.post('/admin/import/challenges', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return resp.data.data as { categoriesCreated: number; challengesCreated: number; challengesSkipped: number; challengesFailed: number; attachmentsLinked: number };
    },
    onSuccess: (s) => {
      toast.success(
        i18n.t('已导入 {{v0}} 题目，{{v1}} 分类，跳过 {{v2}}', { v0: s.challengesCreated, v1: s.categoriesCreated, v2: s.challengesSkipped }),
      );
      qc.invalidateQueries({ queryKey: ['admin-challenges'] });
      qc.invalidateQueries({ queryKey: ['challenges'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('导入失败')),
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{i18n.t('数据导出 / 导入')}</CardTitle>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" onClick={() => exportMut.mutate()} loading={exportMut.isPending}>
              <Download className="h-3.5 w-3.5" />
              {i18n.t('导出全部题目（JSON）')}
            </Button>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importMut.mutate(f);
                  e.target.value = '';
                }}
              />
              <span className="inline-flex items-center gap-1 h-9 px-3 rounded-md border border-border-strong text-sm font-medium hover:bg-surface-2 transition-colors">
                <Upload className="h-3.5 w-3.5" />
                {importMut.isPending ? i18n.t('导入中...') : i18n.t('从 JSON 导入')}
              </span>
            </label>
          </div>
          <p className="text-2xs text-muted">{i18n.t('导出包含分类与题目（含 flag、动态字段、附件元数据；附件文件本身需共享存储卷迁移）。 导入按题目名去重，已存在则跳过。')}</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between gap-3">
          <CardTitle>{i18n.t('实例总览（{{v0}}）', { v0: list.data?.total ?? 0 })}</CardTitle>
          <Field>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-9 px-3 bg-surface border border-border rounded-md text-sm"
            >
              <option value="">{i18n.t('全部')}</option>
              <option value="running">{i18n.t('运行中')}</option>
              <option value="stopped">{i18n.t('已停止')}</option>
              <option value="expired">{i18n.t('已过期')}</option>
              <option value="auto_expired">{i18n.t('自动回收')}</option>
              <option value="error">{i18n.t('错误')}</option>
            </select>
          </Field>
        </CardHeader>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="py-10 flex justify-center"><Spinner className="h-5 w-5 text-muted" /></div>
          ) : (list.data?.items?.length ?? 0) === 0 ? (
            <div className="py-10 text-center text-sm text-muted">{i18n.t('暂无实例。')}</div>
          ) : (
            <>
              <div className="divide-y divide-rule md:hidden">
                {(list.data?.items ?? []).map((inst) => (
                  <div key={inst.id} className="space-y-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {inst.challenge?.title ?? `#${inst.challengeId}`}
                        </p>
                        <p className="truncate text-2xs text-muted">
                          {inst.user?.username ?? `#${inst.userId}`} · {inst.host}:{inst.port}
                        </p>
                      </div>
                      <StatusBadge status={inst.status} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-2xs text-muted">{i18n.t('到期 {{v0}}', { v0: formatTime(inst.expiresAt) })}</span>
                      <InstanceActions
                        compact
                        inst={inst}
                        stopping={stopId === inst.id}
                        onLogs={() => openLogs(inst)}
                        onStop={() => stopInstance(inst)}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-2xs uppercase text-muted bg-surface-2">
                      <th className="text-left px-5 py-2 font-medium">{i18n.t('题目')}</th>
                      <th className="text-left px-5 py-2 font-medium">{i18n.t('用户')}</th>
                      <th className="text-left px-5 py-2 font-medium">{i18n.t('地址')}</th>
                      <th className="text-left px-5 py-2 font-medium">{i18n.t('状态')}</th>
                      <th className="text-left px-5 py-2 font-medium">{i18n.t('到期')}</th>
                      <th className="text-right px-5 py-2 font-medium">{i18n.t('操作')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {(list.data?.items ?? []).map((inst) => (
                      <tr key={inst.id} className="hover:bg-surface-2/40">
                        <td className="px-5 py-2.5">
                          {inst.challenge?.title ?? `#${inst.challengeId}`}
                        </td>
                        <td className="px-5 py-2.5">
                          {inst.user?.username ?? `#${inst.userId}`}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 font-mono text-2xs">
                          {inst.host}:{inst.port}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5">
                          <StatusBadge status={inst.status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-2xs text-muted">
                          {formatTime(inst.expiresAt)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2.5 text-right">
                          <InstanceActions
                            inst={inst}
                            stopping={stopId === inst.id}
                            onLogs={() => openLogs(inst)}
                            onStop={() => stopInstance(inst)}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t border-rule px-5 py-3 text-2xs text-muted">
              <span>{i18n.t('第 {{v0}} / {{v1}} 页 · 共 {{v2}} 个实例', { v0: page, v1: totalPages, v2: total })}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || list.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {i18n.t('上一页')}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || list.isFetching}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {i18n.t('下一页')}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {logsTarget && (
        <LogsModal
          target={logsTarget}
          onClose={() => setLogsTarget(null)}
        />
      )}
    </div>
  );
}

function LogsModal({
  target,
  onClose,
}: {
  target: { id: number; title: string };
  onClose: () => void;
}) {
  const logsQ = useQuery({
    queryKey: ['admin-instance-logs', target.id],
    queryFn: () => adminInstanceLogs(target.id),
    enabled: target.id > 0,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={i18n.t('容器日志 · {{v0}}', { v0: target.title })}
      subtitle={i18n.t('instance #{{v0}} · 最近 500 行', { v0: target.id })}
      width="max-w-3xl"
    >
      {logsQ.isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner className="h-4 w-4 text-ink-3" />
        </div>
      ) : logsQ.isError ? (
        <div className="py-8 text-center text-sm text-ink-3">
          {i18n.t('无法读取日志 —— 接口返回错误。请稍后重试。')}
        </div>
      ) : (
        <pre className="font-mono text-2xs whitespace-pre-wrap break-all text-ink bg-paper-2 p-3 rounded-sm border border-rule leading-relaxed">
          {logsQ.data?.trim() || i18n.t('（无日志输出 —— 容器可能在日志采集前已终止）')}
        </pre>
      )}
    </Modal>
  );
}

function InstanceActions({
  inst,
  stopping,
  compact = false,
  onLogs,
  onStop,
}: {
  inst: Instance;
  stopping: boolean;
  compact?: boolean;
  onLogs: () => void;
  onStop: () => void;
}) {
  return (
    <div className="flex shrink-0 justify-end gap-1 whitespace-nowrap">
      {inst.containerId && (
        <Button
          variant="ghost"
          size="sm"
          className={compact ? 'px-1.5' : undefined}
          onClick={onLogs}
          aria-label={i18n.t('查看日志')}
          title={i18n.t('查看日志')}
        >
          <FileText className="h-3.5 w-3.5" />
          {!compact && i18n.t('日志')}
        </Button>
      )}
      {inst.status === 'running' && (
        <Button
          variant="ghost"
          size="sm"
          className={compact ? 'px-1.5' : undefined}
          loading={stopping}
          onClick={onStop}
          aria-label={i18n.t('销毁实例')}
          title={i18n.t('销毁实例')}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {!compact && i18n.t('销毁')}
        </Button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone: 'success' | 'neutral' | 'warning' | 'danger' =
    status === 'running' ? 'success' :
    status === 'stopped' ? 'neutral' :
    status === 'expired' ? 'neutral' :
    status === 'auto_expired' ? 'warning' : 'danger';
  const label: Record<string, string> = {
    running: i18n.t('运行中'),
    stopped: i18n.t('已停止'),
    expired: i18n.t('已过期'),
    auto_expired: i18n.t('自动回收'),
    error: i18n.t('错误'),
  };
  return <Badge tone={tone}>{label[status] ?? status}</Badge>;
}
