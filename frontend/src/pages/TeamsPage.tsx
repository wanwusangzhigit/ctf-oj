import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trophy, Users, Crown, LogOut, Trash2, Plus } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import {
  createTeam,
  joinTeamByCode,
  leaveTeam,
  myTeam,
  removeTeamMember,
  transferTeamOwner,
  rotateTeamInvite,
  disbandTeam,
} from '@/api/team';
import { formatNumber, relativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { ApiClientError } from '@/api/client';
import type { Team } from '@/types';

export function TeamsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [createForm, setCreateForm] = useState({ name: '', slug: '', description: '' });
  const [joinCode, setJoinCode] = useState('');

  const mine = useQuery({ queryKey: ['my-team'], queryFn: myTeam, enabled: !!user });
  const createMut = useMutation({
    mutationFn: () => createTeam(createForm),
    onSuccess: (t) => {
      toast.success('团队已创建');
      qc.invalidateQueries({ queryKey: ['my-team'] });
      navigate(`/teams/${t.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '创建失败'),
  });
  const joinMut = useMutation({
    mutationFn: () => joinTeamByCode(joinCode.trim()),
    onSuccess: (t) => {
      toast.success('加入成功');
      setJoinCode('');
      qc.invalidateQueries({ queryKey: ['my-team'] });
      navigate(`/teams/${t.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '加入失败'),
  });

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <Card>
          <CardBody className="py-12 text-center text-sm text-muted">
            登录后才能参与团队。
            <Link to="/auth/login" className="text-accent ml-1">前往登录</Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (mine.isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }

  if (mine.data) {
    return <MyTeamView team={mine.data} />;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">团队</h1>
          <p className="text-sm text-muted mt-1">组建队伍，集体冲榜。</p>
        </div>
        <Link to="/teams/scoreboard" className="text-sm text-accent">
          团队榜 →
        </Link>
      </header>

      <div className="flex items-center gap-1 mb-4 border-b border-border">
        <Tab active={tab === 'create'} onClick={() => setTab('create')}>创建团队</Tab>
        <Tab active={tab === 'join'} onClick={() => setTab('join')}>加入团队</Tab>
      </div>

      {tab === 'create' ? (
        <Card>
          <CardBody>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!createForm.name.trim() || !createForm.slug.trim()) {
                  toast.error('名称与 Slug 必填');
                  return;
                }
                createMut.mutate();
              }}
              className="space-y-4"
            >
              <Field label="团队名称">
                <Input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="比如 Pwn Stars"
                />
              </Field>
              <Field label="Slug" hint="小写字母/数字/短横线，作为唯一标识">
                <Input
                  value={createForm.slug}
                  onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                  placeholder="pwn-stars"
                />
              </Field>
              <Field label="简介">
                <Textarea
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                />
              </Field>
              <Button type="submit" loading={createMut.isPending}>
                <Plus className="h-3.5 w-3.5" />
                创建
              </Button>
            </form>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!joinCode.trim()) return;
                joinMut.mutate();
              }}
              className="space-y-3"
            >
              <Field label="邀请码" hint="向队长索取 12 位邀请码">
                <Input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="T-xxxxxxxxxxxx"
                  className="font-mono"
                />
              </Field>
              <Button type="submit" loading={joinMut.isPending}>加入</Button>
            </form>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function MyTeamView({ team }: { team: NonNullable<Awaited<ReturnType<typeof myTeam>>> }) {
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const isOwner = !!user && user.id === team.ownerId;

  const leaveMut = useMutation({
    mutationFn: () => leaveTeam(),
    onSuccess: () => {
      toast.success('已退出团队');
      qc.invalidateQueries({ queryKey: ['my-team'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '退出失败'),
  });

  const disbandMut = useMutation({
    mutationFn: () => disbandTeam(team.id),
    onSuccess: () => {
      toast.success('团队已解散');
      qc.invalidateQueries({ queryKey: ['my-team'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '解散失败'),
  });

  const removeMut = useMutation({
    mutationFn: (memberUserId: number) => removeTeamMember(team.id, memberUserId),
    onSuccess: () => {
      toast.success('已移除成员');
      qc.invalidateQueries({ queryKey: ['my-team'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  const rotateMut = useMutation({
    mutationFn: () => rotateTeamInvite(team.id),
    onSuccess: (res) => {
      toast.success('邀请码已刷新');
      qc.setQueryData(['my-team'], (old: Team | null) =>
        old ? { ...old, inviteCode: res.inviteCode } : old,
      );
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '刷新失败'),
  });

  const transferMut = useMutation({
    mutationFn: (memberUserId: number) => transferTeamOwner(team.id, memberUserId),
    onSuccess: () => {
      toast.success('已转让队长');
      qc.invalidateQueries({ queryKey: ['my-team'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '转让失败'),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
            <Badge tone="accent">@{team.slug}</Badge>
          </div>
          <p className="text-sm text-muted mt-1">{formatNumber(team.score)} 分 · 创建于 {relativeTime(team.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/teams/scoreboard" className="text-sm text-accent mr-2">
            团队榜 →
          </Link>
          {isOwner ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (confirm('解散后将无法恢复，确认？')) disbandMut.mutate();
              }}
              loading={disbandMut.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              解散团队
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (confirm('确认退出该团队？')) leaveMut.mutate();
              }}
              loading={leaveMut.isPending}
            >
              <LogOut className="h-3.5 w-3.5" />
              退出
            </Button>
          )}
        </div>
      </header>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            邀请码
          </CardTitle>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between bg-surface-2 px-3 py-2 rounded-md gap-3">
            <code className="font-mono text-sm truncate">{team.inviteCode ?? '仅队长可见'}</code>
            <div className="flex items-center gap-3 shrink-0">
              {isOwner && !!team.inviteCode && (
                <button
                  type="button"
                  className="text-2xs text-accent hover:underline disabled:opacity-50"
                  disabled={rotateMut.isPending}
                  onClick={() => rotateMut.mutate()}
                >
                  刷新
                </button>
              )}
              {!!team.inviteCode && (
                <button
                  type="button"
                  className="text-2xs text-accent hover:underline"
                  onClick={() => {
                    navigator.clipboard?.writeText(team.inviteCode!).then(() => toast.success('已复制'));
                  }}
                >
                  复制
                </button>
              )}
            </div>
          </div>
          <p className="text-2xs text-muted mt-2">分享此邀请码即可让其他人加入。</p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            成员（{team.members?.length ?? 0}）
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <ul className="divide-y divide-border">
            {(team.members ?? []).map((m) => (
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
                      onClick={() => {
                        if (confirm(`将队长转让给 ${m.user?.username ?? '该成员'}？转让后你将成为普通成员。`)) {
                          transferMut.mutate(m.userId);
                        }
                      }}
                    >
                      <Crown className="h-3.5 w-3.5" />
                      转让队长
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm(`确认移除 ${m.user?.username}?`)) removeMut.mutate(m.userId);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center h-9 px-3 -mb-px border-b-2 text-sm transition-colors ${
        active
          ? 'border-accent text-fg font-medium'
          : 'border-transparent text-muted hover:text-fg'
      }`}
    >
      {children}
    </button>
  );
}
