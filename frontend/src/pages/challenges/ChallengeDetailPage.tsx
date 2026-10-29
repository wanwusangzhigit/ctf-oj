import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Download,
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
  Spinner,
  useToast,
} from '@/components/ui';
import { DynamicInstancePanel } from '@/components/DynamicInstancePanel';
import { DiscussionPanel } from '@/components/DiscussionPanel';
import { HintsPanel } from '@/components/HintsPanel';
import { WriteupsPanel } from '@/components/WriteupsPanel';
import { Markdown } from '@/components/Markdown';
import { formatBytes, formatTime, relativeTime } from '@/lib/utils';
import { ApiClientError } from '@/api/client';
import { challengePodium } from '@/api/stats';
import { getActiveCompetition, getCompetition } from '@/api/competition';
import type { Competition } from '@/types';

export function ChallengeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const challengeId = Number(id);
  const requestedCompetition = Number(searchParams.get('competition'));
  const hasRequestedCompetition = Number.isFinite(requestedCompetition) && requestedCompetition > 0;
  const toast = useToast();
  const qc = useQueryClient();
  const [flag, setFlag] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activeQ = useQuery({
    queryKey: ['active-competition'],
    queryFn: getActiveCompetition,
    enabled: !hasRequestedCompetition,
    staleTime: 30_000,
  });
  const requestedQ = useQuery({
    queryKey: ['competition', requestedCompetition],
    queryFn: () => getCompetition(requestedCompetition),
    enabled: hasRequestedCompetition,
    staleTime: 30_000,
  });
  const competition = hasRequestedCompetition ? requestedQ.data : activeQ.data;
  const contextLoading = hasRequestedCompetition ? requestedQ.isLoading : activeQ.isLoading;
  const contest =
    competition &&
    competitionPhase(competition) === 'live' &&
    competitionCovers(competition, challengeId)
      ? competition
      : null;
  const competitionId = contest?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['challenge', challengeId, competitionId ?? 0],
    queryFn: () => getChallenge(challengeId, competitionId),
    enabled: !Number.isNaN(challengeId) && !contextLoading,
    staleTime: 15_000,
  });

  const podium = useQuery({
    queryKey: ['challenge-podium', challengeId],
    queryFn: () => challengePodium(challengeId),
    enabled: !Number.isNaN(challengeId),
    staleTime: 30_000,
  });

  if (contextLoading || isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <div className="border-t-2 border-ink pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            题目不存在或已下线
          </h1>
          <p className="mt-2 text-ink-3">
            它可能被发布者删除，或被管理员下架。
          </p>
          <div className="mt-4">
            <Link
              to="/challenges"
              className="inline-flex items-center gap-1 text-amber font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回题目列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const solvedInMode = contest ? data.competitionSolved : data.solved;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flag.trim()) return;
    setSubmitting(true);
    try {
      const res = await submitFlag(challengeId, flag.trim(), competitionId);
      if (res.correct) {
        if (res.alreadySolved) {
          toast.success('Accepted · 已解出，本次不计分');
        } else if (res.competitionId) {
          toast.success(`Accepted · 比赛 +${res.score}`);
        } else {
          toast.success(`Accepted · +${res.score}`);
        }
        qc.invalidateQueries({ queryKey: ['challenge', challengeId] });
        qc.invalidateQueries({ queryKey: ['challenges'] });
        if (res.competitionId) {
          qc.invalidateQueries({ queryKey: ['competition-scoreboard', res.competitionId] });
          qc.invalidateQueries({ queryKey: ['competition-team-scoreboard', res.competitionId] });
        }
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
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link
        to={contest ? `/competitions/${contest.id}` : '/challenges'}
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors mb-6 hover:no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {contest ? '返回赛事' : '返回题目列表'}
      </Link>

      {contest && (
        <div className="mb-6 border border-amber/30 bg-amber-soft rounded-sm px-4 py-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge tone="accent">比赛模式</Badge>
            <Link
              to={`/competitions/${contest.id}`}
              className="text-sm font-medium text-ink hover:text-amber hover:no-underline"
            >
              {contest.name}
            </Link>
          </div>
          <p className="mt-1 text-2xs text-ink-3 leading-relaxed">
            本题提交计入赛事。已解出后可重复提交，但不会再次加分。
          </p>
        </div>
      )}

      {!contest && hasRequestedCompetition && competition && (
        <p className="mb-6 text-2xs text-ink-3">
          该赛事当前不在进行中，本题按练习模式提交。
        </p>
      )}

      <header className="border-t-2 border-ink pt-6 mb-10">
        <div className="font-mono text-2xs text-ink-3 mb-3 tabular-nums">
          #{String(data.id).padStart(3, '0')} · {data.category?.name ?? 'uncategorized'}
          {data.solved && ' · 练习已通过'}
          {contest && data.competitionSolved && ' · 比赛已解出'}
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {data.title}
        </h1>
        <div className="mt-4 flex items-center gap-6 flex-wrap text-sm">
          <Meta label="基础分" value={data.baseScore.toString()} />
          <Meta label="最低分" value={data.minScore.toString()} />
          <Meta label="难度" value={`${data.difficulty}/5`} />
          <Meta label="解题" value={`${data.solveCount} 人`} />
          {data.solved && (
            <Badge tone="accent">
              <CheckCircle2 className="h-3 w-3" />
              练习已通过
            </Badge>
          )}
          {contest && data.competitionSolved && (
            <Badge tone="success">
              <CheckCircle2 className="h-3 w-3" />
              比赛已解出
            </Badge>
          )}
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-10 min-w-0">
          <section>
            <SectionLabel>描述</SectionLabel>
            {data.description ? (
              <div className="max-w-prose">
                <Markdown>{data.description}</Markdown>
              </div>
            ) : (
              <p className="text-ink-3 max-w-prose">
                这道题没有描述 —— 尝试从附件或连接信息入手。
              </p>
            )}
          </section>

          {data.attachments?.length > 0 && (
            <section>
              <SectionLabel>附件</SectionLabel>
              <ul className="border-t border-rule">
                {data.attachments.map((a) => (
                  <li
                    key={a.id}
                    className="grid grid-cols-[auto_1fr_auto] gap-x-3 items-center py-2.5 border-b border-rule"
                  >
                    <Paperclip className="h-3.5 w-3.5 text-ink-3" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {a.filename}
                      </div>
                      <div className="font-mono text-2xs text-ink-3 tabular-nums">
                        {formatBytes(a.size)} · {formatTime(a.createdAt)}
                      </div>
                    </div>
                    <a
                      href={attachmentDownloadURL(data.id, a.id)}
                      className="inline-flex items-center gap-1 h-7 px-2.5 text-2xs font-mono rounded-sm border border-rule hover:border-rule-strong hover:bg-paper-2 transition-colors"
                    >
                      <Download className="h-3 w-3" />
                      下载
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {podium.data && podium.data.length > 0 && (
            <section>
              <SectionLabel>一血时刻</SectionLabel>
              <ul className="border-t border-rule">
                {podium.data.map((p) => (
                  <li
                    key={p.userId}
                    className="grid grid-cols-[2.5rem_1fr_auto] gap-x-3 items-center py-2.5 border-b border-rule"
                  >
                    <span className="font-mono text-2xs text-amber tabular-nums">
                      #{p.rank}
                    </span>
                    <span className="text-sm truncate">{p.username}</span>
                    <span className="font-mono text-2xs text-ink-3 tabular-nums">
                      {relativeTime(p.solvedAt)} · {p.score}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.solved && data.editorial && (
            <section>
              <SectionLabel>题解</SectionLabel>
              <div className="max-w-prose">
                <Markdown>{data.editorial}</Markdown>
              </div>
            </section>
          )}

          <HintsPanel challengeId={data.id} />

          <WriteupsPanel challengeId={data.id} solved={data.solved} />

          <DiscussionPanel target={{ scope: 'challenge', id: data.id }} />
        </div>

        <aside className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>提交 flag</CardTitle>
            </CardHeader>
            <CardBody>
              <form onSubmit={onSubmit} className="space-y-3">
                <TerminalInput
                  value={flag}
                  onChange={(v) => setFlag(v)}
                  placeholder={
                    data.isDynamic ? 'flag from your instance' : 'flag{...}'
                  }
                />
                <Button
                  type="submit"
                  loading={submitting}
                  variant="primary"
                  className="w-full"
                >
                  {solvedInMode ? '再次提交' : '提交'}
                </Button>
                {solvedInMode && (
                  <p className="text-2xs text-ink-3 leading-relaxed">
                    {contest ? '本题已在赛事中解出' : '本题已通过'}，可重复提交，但不再加分。
                  </p>
                )}
                {data.isDynamic && !solvedInMode && (
                  <p className="text-2xs text-ink-3 leading-relaxed">
                    先启动下方的容器实例，再从实例中获取 flag 并提交。
                  </p>
                )}
              </form>
            </CardBody>
          </Card>

          {data.isDynamic && (
            <DynamicInstancePanel
              challengeId={data.id}
              protocol={data.protocol ?? 'tcp'}
              solved={data.solved || (!!contest && data.competitionSolved)}
              onSolvedRefresh={() =>
                qc.invalidateQueries({ queryKey: ['challenge', challengeId] })
              }
            />
          )}

          {data.connectionInfo && !data.isDynamic && (
            <Card>
              <CardHeader>
                <CardTitle>连接信息</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="flex items-center gap-2 font-mono text-sm bg-paper-2 px-3 py-2 rounded-sm border border-rule">
                  <Server className="h-3.5 w-3.5 text-ink-3 shrink-0" />
                  <span className="flex-1 truncate">{data.connectionInfo}</span>
                  <button
                    type="button"
                    aria-label="复制"
                    className="text-ink-3 hover:text-amber transition-colors"
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(data.connectionInfo)
                        .then(() => toast.success('已复制到剪贴板'));
                    }}
                  >
                    <Copy8 className="h-3.5 w-3.5" />
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
              <dl className="space-y-2.5 text-sm">
                <Row label="分类">{data.category?.name ?? '—'}</Row>
                <Row label="类型">
                  {data.isDynamic ? (
                    <Badge tone="accent">容器</Badge>
                  ) : (
                    <Badge>静态</Badge>
                  )}
                </Row>
                <Row label="标签">
                  <span className="font-mono text-2xs">
                    {data.tags || '—'}
                  </span>
                </Row>
                <Row label="创建">
                  <span className="font-mono text-2xs">
                    {relativeTime(data.createdAt)}
                  </span>
                </Row>
              </dl>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/**
 * Terminal-prompt input — the flag field looks like a TTY line:
 *
 *   > flag{________________________________________}   ▌
 *
 * The amber caret is decorative-only; the real cursor is the native one.
 * Respects prefers-reduced-motion (the blink is disabled there).
 */
function TerminalInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  return (
    <label className="group block">
      <span className="flex items-stretch border border-rule rounded-sm overflow-hidden focus-within:border-amber transition-colors">
        <span className="flex items-center px-2.5 font-mono text-sm text-amber bg-amber-soft select-none">
          &gt;
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          spellCheck={false}
          autoComplete="off"
          className="flex-1 bg-paper px-3 h-9 font-mono text-sm focus:outline-none disabled:bg-paper-2 disabled:text-ink-3"
        />
      </span>
    </label>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-rule pb-2 mb-4">
      <h2 className="text-sm font-medium text-ink">{children}</h2>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-2xs text-ink-3 font-mono">{label}</span>
      <span className="font-mono tabular-nums text-ink">{value}</span>
    </div>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-3 text-2xs font-mono">{label}</dt>
      <dd className="font-medium text-right truncate max-w-[60%] text-sm">
        {children}
      </dd>
    </div>
  );
}

function Copy8(props: React.SVGProps<SVGSVGElement>) {
  // lightweight copy glyph — avoids loading an extra lucide icon
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="9" y="9" width="11" height="11" rx="1" />
      <path d="M5 15V5a1 1 0 0 1 1-1h10" />
    </svg>
  );
}


function competitionPhase(c: Competition): 'upcoming' | 'live' | 'ended' | 'unscheduled' {
  if (!c.startAt && !c.endAt) return 'unscheduled';
  const start = c.startAt ? Date.parse(c.startAt) : -Infinity;
  const end = c.endAt ? Date.parse(c.endAt) : Infinity;
  const now = Date.now();
  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'live';
}

function competitionCovers(c: Competition, challengeId: number): boolean {
  const bound = c.boundChallengeCount ?? c.challenges?.length ?? 0;
  if (bound === 0) return true;
  return c.challenges?.some((ch) => ch.id === challengeId) ?? false;
}
