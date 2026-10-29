import { useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, Mail } from 'lucide-react';
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
import {
  getUser,
  mySolves,
  mySubmissions,
  updateProfile,
  changePassword,
  uploadAvatar,
  avatarURL,
  followUser,
  unfollowUser,
  setup2FA,
  enable2FA,
  disable2FA,
} from '@/api/user';
import { resendVerification } from '@/api/email';
import { useAuthStore } from '@/stores/auth';
import { Avatar } from '@/components/layout/Avatar';
import { ApiClientError } from '@/api/client';
import { formatNumber, formatTime } from '@/lib/utils';
import { userActivity, userAchievements } from '@/api/stats';
import { cn } from '@/lib/utils';
import type { Achievement, Solve, SubmissionWithChallenge } from '@/types';

type Panel = 'solves' | 'submissions';

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const uid = Number(id);
  const me = useAuthStore((s) => s.user);
  const isMe = !!me && me.id === uid;
  const qc = useQueryClient();
  const toast = useToast();

  const userQ = useQuery({
    queryKey: ['user', uid],
    queryFn: () => getUser(uid),
    enabled: !Number.isNaN(uid),
  });
  const solvesQ = useQuery({
    queryKey: ['user-solves', uid],
    queryFn: () => mySolves(),
    enabled: isMe,
  });
  const activityQ = useQuery({
    queryKey: ['user-activity', uid],
    queryFn: () => userActivity(uid, 365),
    enabled: Number.isFinite(uid) && !userQ.data?.privateProfile,
    staleTime: 60_000,
  });
  const achievementsQ = useQuery({
    queryKey: ['user-achievements', uid],
    queryFn: () => userAchievements(uid),
    enabled: Number.isFinite(uid) && !userQ.data?.privateProfile,
    staleTime: 60_000,
  });
  const [panel, setPanel] = useState<Panel>('solves');

  const followMut = useMutation({
    mutationFn: (next: boolean) => (next ? followUser(uid) : unfollowUser(uid)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['user', uid] }),
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  if (userQ.isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }
  if (!userQ.data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <Card>
          <CardBody className="py-10 text-center text-sm text-muted">
            用户不存在。
          </CardBody>
        </Card>
      </div>
    );
  }

  const u = userQ.data;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <Card>
        <CardBody>
          <div className="flex items-start gap-5">
            <AvatarBlock user={u} editable={isMe} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{u.username}</h1>
                {u.role === 'admin' && <Badge tone="accent">管理员</Badge>}
              </div>
              <p className="text-2xs text-muted mt-1">
                注册于 {formatTime(u.createdAt)}
              </p>
              {isMe && !u.emailVerifiedAt && (
                <EmailVerificationNotice email={u.email ?? ''} />
              )}
              {u.bio && <p className="mt-3 text-sm text-fg">{u.bio}</p>}
              <div className="mt-3 flex items-center gap-4 font-mono text-2xs text-muted tabular-nums">
                <span>{formatNumber(u.followerCount ?? 0)} 关注者</span>
                <span>{formatNumber(u.followingCount ?? 0)} 关注中</span>
              </div>
            </div>
            <div className="text-right space-y-2">
              <div>
                <div className="text-2xs text-muted">积分</div>
                <div className="text-2xl font-semibold tabular-nums">
                  {formatNumber(u.score)}
                </div>
              </div>
              {me && !isMe && (
                <Button
                  size="sm"
                  variant={u.isFollowing ? 'outline' : 'primary'}
                  loading={followMut.isPending}
                  onClick={() => followMut.mutate(!u.isFollowing)}
                >
                  {u.isFollowing ? '取消关注' : '关注'}
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>

      {u.privateProfile && (
        <Card>
          <CardBody className="text-sm text-muted">
            该用户未公开个人资料与活动记录。
          </CardBody>
        </Card>
      )}

      {!u.privateProfile && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>解题活动</CardTitle>
            </CardHeader>
            <CardBody>
              <ActivityHeatmap days={activityQ.data ?? []} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>成就</CardTitle>
            </CardHeader>
            <CardBody>
              <AchievementList items={achievementsQ.data ?? []} />
            </CardBody>
          </Card>
        </div>
      )}

      {isMe && (
        <BioEditor
          currentBio={u.bio}
          currentVisibility={u.profileVisibility ?? 'public'}
        />
      )}

      {isMe && <PasswordEditor />}
      {isMe && <TwoFactorEditor enabled={!!u.twoFactorEnabled} />}

      {isMe && (
        <Card>
          <CardHeader className="flex items-center gap-1 border-b border-rule">
            <TabButton
              active={panel === 'solves'}
              onClick={() => setPanel('solves')}
            >
              解题
            </TabButton>
            <TabButton
              active={panel === 'submissions'}
              onClick={() => setPanel('submissions')}
            >
              提交记录
            </TabButton>
          </CardHeader>
          <CardBody className="p-0">
            {panel === 'solves' ? (
              <SolvesPanel solvesQ={solvesQ} />
            ) : (
              <SubmissionsPanel uid={uid} />
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function AvatarBlock({
  user,
  editable,
}: {
  user: { id: number; username: string; emailVerifiedAt?: string; hasAvatar?: boolean };
  editable: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

  const onPick = async () => fileRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error('头像不能超过 2MB');
      return;
    }
    setUploading(true);
    try {
      await uploadAvatar(f);
      await qc.invalidateQueries({ queryKey: ['user', user.id] });
      toast.success('头像已更新');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="relative shrink-0">
      {user.hasAvatar && !avatarFailed ? (
        <img
          src={avatarURL(user.id)}
          alt={user.username}
          className="h-16 w-16 rounded-sm object-cover border border-rule bg-paper-2"
          onError={() => setAvatarFailed(true)}
        />
      ) : (
        <Avatar name={user.username} className="h-16 w-16 text-xl" />
      )}
      {editable && (
        <button
          type="button"
          onClick={onPick}
          disabled={uploading}
          aria-label="更换头像"
          className="absolute -bottom-1 -right-1 inline-flex h-6 w-6 items-center justify-center rounded-sm bg-ink text-paper border border-paper hover:bg-ink-2 transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <Spinner className="h-3 w-3" />
          ) : (
            <Camera className="h-3 w-3" />
          )}
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}

function BioEditor({
  currentBio,
  currentVisibility,
}: {
  currentBio: string;
  currentVisibility: 'public' | 'private';
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [bio, setBio] = useState(currentBio ?? '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(currentVisibility);
  const [pending, setPending] = useState(false);

  const save = async () => {
    setPending(true);
    try {
      await updateProfile({ bio, profileVisibility: visibility });
      qc.invalidateQueries({ queryKey: ['user'] });
      toast.success('已保存');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : '保存失败');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>编辑资料</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <Field label="个人简介" hint="Markdown 不支持 —— 纯文本">
          <Textarea
            rows={3}
            value={bio}
            maxLength={500}
            placeholder="一句话介绍自己"
            onChange={(e) => setBio(e.target.value)}
          />
        </Field>
        <Field label="资料可见性" hint="私有后仅自己与管理员可见">
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as 'public' | 'private')}
            className="h-9 px-2 bg-paper border border-rule rounded-sm text-sm"
          >
            <option value="public">公开</option>
            <option value="private">私有</option>
          </select>
        </Field>
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            loading={pending}
            disabled={bio === (currentBio ?? '') && visibility === currentVisibility}
          >
            保存
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function PasswordEditor() {
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);

  const save = async () => {
    if (next.length < 8) return toast.error('新密码至少 8 位');
    if (next !== confirm) return toast.error('两次输入的新密码不一致');
    setPending(true);
    try {
      await changePassword(current, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast.success('密码已更新');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : '修改失败');
    } finally {
      setPending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>修改密码</CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        <Field label="当前密码">
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="新密码" hint="至少 8 位">
            <Input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label="确认新密码">
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={save}
            loading={pending}
            disabled={!current || !next || !confirm}
          >
            更新密码
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function EmailVerificationNotice({ email }: { email: string }) {
  const toast = useToast();
  const [pending, setPending] = useState(false);
  const resend = async () => {
    setPending(true);
    try {
      await resendVerification();
      toast.success(`验证邮件已发送至 ${email}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : '发送失败');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mt-4 flex items-center gap-3 border border-amber/30 bg-amber-soft rounded-sm px-3 py-2">
      <Mail className="h-3.5 w-3.5 text-amber shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-2xs text-ink-2">
          邮箱 <span className="font-mono">{email}</span> 尚未验证。
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={resend} loading={pending}>
        重发
      </Button>
    </div>
  );
}

function SolvesPanel({
  solvesQ,
}: {
  solvesQ: ReturnType<typeof useQuery<Solve[]>>;
}) {
  if (solvesQ.isLoading) {
    return (
      <div className="py-10 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }
  if (!solvesQ.data?.length) {
    return (
      <div className="py-10 text-center text-sm text-muted">还没有解题记录。</div>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {solvesQ.data.map((s) => (
        <li
          key={s.id}
          className="px-5 py-3 flex items-center justify-between gap-3"
        >
          <div className="min-w-0">
            <div className="font-medium truncate">
              {s.challenge?.title ?? `题目 #${s.challengeId}`}
            </div>
            <div className="text-2xs text-muted">{formatTime(s.solvedAt)}</div>
          </div>
          <div className="flex items-center gap-2">
            {s.isFirstBlood && <Badge tone="warning">首杀</Badge>}
            <span className="font-mono text-sm tabular-nums">+{s.score}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SubmissionsPanel({ uid }: { uid: number }) {
  const q = useQuery({
    queryKey: ['user-submissions', uid],
    queryFn: () => mySubmissions(1, 100),
  });

  if (q.isLoading) {
    return (
      <div className="py-10 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-muted" />
      </div>
    );
  }
  if (!q.data?.items?.length) {
    return (
      <div className="py-10 text-center text-sm text-muted">
        还没有提交记录。
      </div>
    );
  }
  const items: SubmissionWithChallenge[] = q.data.items;
  return (
    <ul className="divide-y divide-border">
      {items.map((s) => (
        <li
          key={s.id}
          className="px-5 py-2.5 flex items-center justify-between gap-3"
        >
          <div className="min-w-0 flex items-center gap-2">
            <span
              className={cn(
                'inline-flex h-3 w-3 rounded-sm shrink-0',
                s.isCorrect ? 'bg-amber' : 'bg-paper-3 border border-rule',
              )}
              aria-label={s.isCorrect ? 'correct' : 'wrong'}
            />
            <div className="min-w-0">
              <div className="text-sm truncate">
                {s.challenge?.title ?? `题目 #${s.challengeId}`}
              </div>
              <div className="font-mono text-2xs text-muted truncate">
                {s.flag}
              </div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-2xs text-muted tabular-nums">
              {formatTime(s.createdAt)}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TabButton({
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
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 h-9 inline-flex items-center text-sm border-b-2 -mb-px transition-colors',
        active
          ? 'border-amber text-ink font-medium'
          : 'border-transparent text-muted hover:text-fg',
      )}
    >
      {children}
    </button>
  );
}

function ActivityHeatmap({ days }: { days: { date: string; count: number }[] }) {
  const cells = useMemo(() => {
    const map = new Map(days.map((d) => [d.date, d.count]));
    const out: { date: string; count: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, count: map.get(key) ?? 0 });
    }
    return out;
  }, [days]);

  return (
    <div className="space-y-2">
      <div className="grid grid-rows-7 grid-flow-col gap-1 overflow-x-auto">
        {cells.map((c) => (
          <div
            key={c.date}
            title={`${c.date}: ${c.count}`}
            className={cn(
              'h-2.5 w-2.5 rounded-[1px]',
              c.count === 0 ? 'bg-rule' : 'bg-amber',
            )}
            style={c.count > 0 ? { opacity: Math.min(0.35 + c.count * 0.2, 1) } : undefined}
          />
        ))}
      </div>
      <div className="flex items-center justify-between font-mono text-2xs text-muted">
        <span>过去 365 天</span>
        <span>{cells.reduce((n, c) => n + c.count, 0)} 次解题</span>
      </div>
    </div>
  );
}

function AchievementList({ items }: { items: Achievement[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">暂无成就数据。</p>;
  }
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li key={a.key} className="flex items-start gap-2">
          <span
            className={cn(
              'mt-1.5 h-2 w-2 rounded-full shrink-0',
              a.earned ? 'bg-amber' : 'bg-rule',
            )}
          />
          <div className="min-w-0">
            <div className={cn('text-sm', a.earned ? 'text-ink' : 'text-muted')}>
              {a.label}
            </div>
            <div className="text-2xs text-muted">
              {a.description} · {Math.min(a.progress, a.target)}/{a.target}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TwoFactorEditor({ enabled }: { enabled: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [secret, setSecret] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const refresh = () => void qc.invalidateQueries({ queryKey: ['user'] });
  const fail = (err: unknown) =>
    toast.error(err instanceof ApiClientError ? err.message : '操作失败');

  const setupMut = useMutation({
    mutationFn: setup2FA,
    onSuccess: (data) => setSecret(data),
    onError: fail,
  });
  const enableMut = useMutation({
    mutationFn: () => enable2FA(code.trim()),
    onSuccess: () => {
      toast.success('两步验证已启用');
      setSecret(null);
      setCode('');
      refresh();
    },
    onError: fail,
  });
  const disableMut = useMutation({
    mutationFn: () => disable2FA(password),
    onSuccess: () => {
      toast.success('两步验证已关闭');
      setPassword('');
      refresh();
    },
    onError: fail,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>两步验证</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {enabled ? (
          <>
            <p className="text-sm text-fg">
              已启用 TOTP。登录时需要输入验证器 App 中的 6 位验证码。
            </p>
            <Field label="当前密码" hint="关闭前需确认密码">
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </Field>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                loading={disableMut.isPending}
                disabled={!password}
                onClick={() => disableMut.mutate()}
              >
                关闭两步验证
              </Button>
            </div>
          </>
        ) : secret ? (
          <>
            <p className="text-sm text-fg">
              在验证器 App 中手动添加以下密钥，然后输入生成的 6 位验证码。
            </p>
            <div className="border border-rule bg-paper-2 rounded-sm p-3 space-y-2">
              <div className="font-mono text-sm break-all text-ink">{secret.secret}</div>
              <div className="font-mono text-2xs text-muted break-all">
                {secret.otpauthUrl}
              </div>
            </div>
            <Field label="验证码">
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSecret(null)}>
                取消
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={enableMut.isPending}
                disabled={code.trim().length !== 6}
                onClick={() => enableMut.mutate()}
              >
                启用
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-muted">
              启用后登录需要额外的 6 位动态验证码。
            </p>
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                loading={setupMut.isPending}
                onClick={() => setupMut.mutate()}
              >
                启用两步验证
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
