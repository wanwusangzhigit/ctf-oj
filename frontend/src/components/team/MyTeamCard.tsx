import i18n from '@/locales/i18n';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LogOut, Trash2, Users } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, useConfirm, useToast } from '@/components/ui';
import { disbandTeam, leaveTeam, rotateTeamInvite } from '@/api/team';
import { useAuthStore } from '@/stores/auth';
import { ApiClientError } from '@/api/client';
import { formatNumber, relativeTime } from '@/lib/utils';
import type { Team } from '@/types';

/**
 * Team header, invite code and the membership exit actions.
 * Member-level actions live in TeamMemberTable.
 */
export function MyTeamCard({ team }: { team: Team }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const user = useAuthStore((s) => s.user);
  const isOwner = !!user && user.id === team.ownerId;

  const refresh = () => void qc.invalidateQueries({ queryKey: ['my-team'] });

  const leaveMut = useMutation({
    mutationFn: leaveTeam,
    onSuccess: () => {
      toast.success(i18n.t('已退出团队'));
      refresh();
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('退出失败')),
  });

  const disbandMut = useMutation({
    mutationFn: () => disbandTeam(team.id),
    onSuccess: () => {
      toast.success(i18n.t('团队已解散'));
      refresh();
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('解散失败')),
  });

  const rotateMut = useMutation({
    mutationFn: () => rotateTeamInvite(team.id),
    onSuccess: (res) => {
      toast.success(i18n.t('邀请码已刷新'));
      qc.setQueryData(['my-team'], (old: Team | null) =>
        old ? { ...old, inviteCode: res.inviteCode } : old,
      );
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('刷新失败')),
  });

  const copyCode = () => {
    if (!team.inviteCode) return;
    navigator.clipboard?.writeText(team.inviteCode).then(() => toast.success(i18n.t('已复制')));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardBody>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold tracking-tight">{team.name}</h2>
                <Badge tone="accent">@{team.slug}</Badge>
                {isOwner && <Badge tone="warning">{i18n.t('队长')}</Badge>}
              </div>
              <p className="text-sm text-muted mt-1">{i18n.t('{{v0}} 分 · 创建于 {{v1}}', { v0: formatNumber(team.score), v1: relativeTime(team.createdAt) })}</p>
              {team.description && <p className="mt-3 text-sm text-fg">{team.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/teams/${team.id}`} className="text-sm text-accent">
                {i18n.t('团队主页 →')}
              </Link>
              {isOwner ? (
                <Button
                  variant="danger"
                  size="sm"
                  loading={disbandMut.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: i18n.t('解散团队'),
                      description: i18n.t('解散「{{v0}}」后成员关系一并删除，且无法恢复。', { v0: team.name }),
                      confirmText: i18n.t('解散团队'),
                    });
                    if (ok) disbandMut.mutate();
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {i18n.t('解散团队')}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  loading={leaveMut.isPending}
                  onClick={async () => {
                    const ok = await confirm({
                      title: i18n.t('退出团队'),
                      description: i18n.t('退出后需要新的邀请码才能重新加入该团队。'),
                      confirmText: i18n.t('退出'),
                      danger: false,
                    });
                    if (ok) leaveMut.mutate();
                  }}
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {i18n.t('退出')}
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {i18n.t('邀请码')}
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between bg-surface-2 px-3 py-2 rounded-md gap-3">
            <code className="font-mono text-sm truncate">
              {team.inviteCode || i18n.t('仅队长可见')}
            </code>
            <div className="flex items-center gap-3 shrink-0">
              {isOwner && !!team.inviteCode && (
                <button
                  type="button"
                  className="text-2xs text-accent hover:underline disabled:opacity-50"
                  disabled={rotateMut.isPending}
                  onClick={() => rotateMut.mutate()}
                >
                  {i18n.t('刷新')}
                </button>
              )}
              {!!team.inviteCode && (
                <button
                  type="button"
                  className="text-2xs text-accent hover:underline"
                  onClick={copyCode}
                >
                  {i18n.t('复制')}
                </button>
              )}
            </div>
          </div>
          <p className="text-2xs text-muted mt-2">{i18n.t('分享此邀请码即可让其他人加入。')}</p>
        </CardBody>
      </Card>
    </div>
  );
}
