import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Crown, Trash2, Users } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, CardTitle, useConfirm, useToast } from '@/components/ui';
import { removeTeamMember, transferTeamOwner } from '@/api/team';
import { useAuthStore } from '@/stores/auth';
import { ApiClientError } from '@/api/client';
import { formatNumber, relativeTime } from '@/lib/utils';
import { Avatar } from '@/components/layout/Avatar';
import type { Team } from '@/types';

/** Roster with the owner-only transfer and removal actions. */
export function TeamMemberTable({ team }: { team: Team }) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const user = useAuthStore((s) => s.user);
  const isOwner = !!user && user.id === team.ownerId;

  const refresh = () => void qc.invalidateQueries({ queryKey: ['my-team'] });

  const removeMut = useMutation({
    mutationFn: (memberUserId: number) => removeTeamMember(team.id, memberUserId),
    onSuccess: () => {
      toast.success('已移除成员');
      refresh();
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  const transferMut = useMutation({
    mutationFn: (memberUserId: number) => transferTeamOwner(team.id, memberUserId),
    onSuccess: () => {
      toast.success('已转让队长');
      refresh();
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '转让失败'),
  });

  const members = team.members ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          成员（{members.length}）
        </CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {members.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">暂无成员。</p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={m.user?.username ?? '?'} />
                  <Link to={`/users/${m.userId}`} className="font-medium hover:text-accent">
                    {m.user?.username ?? `#${m.userId}`}
                  </Link>
                  {m.userId === team.ownerId && (
                    <Badge tone="warning">
                      <Crown className="h-3 w-3" />
                      队长
                    </Badge>
                  )}
                  <span className="text-2xs text-muted">
                    {formatNumber(m.user?.score ?? 0)} 分 · 加入于 {relativeTime(m.joinedAt)}
                  </span>
                </div>
                {isOwner && m.userId !== team.ownerId && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={transferMut.isPending}
                      onClick={async () => {
                        const ok = await confirm({
                          title: '转让队长',
                          description: `将队长转让给 ${m.user?.username ?? '该成员'}？转让后你将成为普通成员。`,
                          confirmText: '转让队长',
                          danger: false,
                        });
                        if (ok) transferMut.mutate(m.userId);
                      }}
                    >
                      <Crown className="h-3.5 w-3.5" />
                      转让队长
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`移除 ${m.user?.username ?? `#${m.userId}`}`}
                      onClick={async () => {
                        const ok = await confirm({
                          title: '移除成员',
                          description: `确认把 ${m.user?.username ?? '该成员'} 移出团队？`,
                          confirmText: '移除',
                        });
                        if (ok) removeMut.mutate(m.userId);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
