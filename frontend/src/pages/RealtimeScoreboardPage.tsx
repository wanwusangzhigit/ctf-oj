import i18n from '@/locales/i18n';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame, Trophy } from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle, Badge, Spinner, Button } from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { scoreboard } from '@/api/user';
import { recentSolves } from '@/api/stats';
import { formatNumber, relativeTime } from '@/lib/utils';
import type { RecentSolve } from '@/types';

type WSEvent = {
  type: string;
  payload: unknown;
  at: string;
};

type SolveEvent = {
  challengeId: number;
  challengeTitle: string;
  username: string;
  score: number;
  isFirstBlood: boolean;
};

export function RealtimeScoreboardPage() {
  const qc = useQueryClient();
  const [events, setEvents] = useState<SolveEvent[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  const board = useQuery({
    queryKey: ['scoreboard', 'realtime'],
    queryFn: () => scoreboard(1, 50),
    staleTime: 0,
  });
  const recent = useQuery({
    queryKey: ['recent-solves', 'realtime'],
    queryFn: () => recentSolves(15),
    staleTime: 0,
  });

  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${proto}://${window.location.host}/api/v1/realtime`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (msg) => {
      try {
        const ev = JSON.parse(msg.data) as WSEvent;
        if (ev.type === 'solve') {
          const se = ev.payload as SolveEvent;
          setEvents((prev) => [se, ...prev].slice(0, 20));
          qc.invalidateQueries({ queryKey: ['scoreboard'] });
          qc.invalidateQueries({ queryKey: ['recent-solves'] });
        }
      } catch {
        // ignore
      }
    };
    return () => {
      ws.close();
    };
  }, [qc]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{i18n.t('实时记分板')}</h1>
          <p className="text-sm text-muted mt-1">{i18n.t('通过 WebSocket 推送最新解题事件。')}</p>
        </div>
        <Badge tone={connected ? 'success' : 'neutral'}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-success' : 'bg-muted'}`}
          />
          {connected ? i18n.t('已连接') : i18n.t('离线')}
        </Badge>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{i18n.t('排行榜（实时更新）')}</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {board.isLoading ? (
              <div className="py-16 flex items-center justify-center">
                <Spinner className="h-5 w-5 text-muted" />
              </div>
            ) : board.data?.items?.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-2xs uppercase text-muted bg-surface-2">
                    <th className="text-left px-5 py-2 font-medium w-12">#</th>
                    <th className="text-left px-5 py-2 font-medium">{i18n.t('选手')}</th>
                    <th className="text-right px-5 py-2 font-medium">{i18n.t('积分')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {board.data.items.map((u, idx) => (
                    <tr key={u.id} className="hover:bg-surface-2/40">
                      <td className="px-5 py-2.5 font-mono text-muted">{idx + 1}</td>
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar name={u.username} />
                          <span className="font-medium">{u.username}</span>
                          {idx === 0 && <Trophy className="h-3 w-3 text-warning" />}
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                        {formatNumber(u.score)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-16 text-center text-sm text-muted">{i18n.t('榜单为空。')}</div>
            )}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{i18n.t('解题事件')}</CardTitle>
            </CardHeader>
            <CardBody className="p-0">
              {(events.length > 0 || (recent.data?.length ?? 0) > 0) ? (
                <ul className="divide-y divide-border">
                  {(events.length > 0
                    ? events.map((e, idx) => ({
                        key: `live-${idx}`,
                        username: e.username,
                        title: e.challengeTitle,
                        score: e.score,
                        firstBlood: e.isFirstBlood,
                        solvedAt: undefined as string | undefined,
                        live: true,
                      }))
                    : (recent.data ?? []).map((r: RecentSolve, idx) => ({
                        key: `recent-${idx}`,
                        username: r.username,
                        title: r.challengeName,
                        score: r.score,
                        firstBlood: r.isFirstBlood,
                        solvedAt: r.solvedAt,
                        live: false,
                      }))
                  ).map((it) => (
                    <li key={it.key} className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        {it.live && (
                          <span className="inline-flex items-center gap-1 text-2xs text-danger">
                            <Flame className="h-3 w-3" />
                            LIVE
                          </span>
                        )}
                        <Avatar name={it.username} />
                        <span className="font-medium text-sm">{it.username}</span>
                        {it.firstBlood && (
                          <Badge tone="warning">{i18n.t('首杀')}</Badge>
                        )}
                      </div>
                      <div className="text-2xs text-muted mt-1">
                        {i18n.t('解出')} <Link to={`/challenges/`} className="text-accent">{it.title}</Link>
                        <span className="ml-2 font-mono">+{it.score}</span>
                        {!it.live && it.solvedAt && (
                          <span className="ml-2">{relativeTime(it.solvedAt)}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="py-10 text-center text-sm text-muted">
                  {i18n.t('等待事件…')}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="text-sm text-muted">
              {i18n.t('解题事件会在选手提交正确 Flag 后即时推送到本页；同时刷新榜单与最近活动。')}
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => {
                  qc.invalidateQueries({ queryKey: ['scoreboard'] });
                  qc.invalidateQueries({ queryKey: ['recent-solves'] });
                }}>
                  {i18n.t('手动刷新')}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
