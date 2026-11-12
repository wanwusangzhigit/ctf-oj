import i18n from '@/locales/i18n';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge, Button, Input, useToast } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import {
  registerCompetition,
  unregisterCompetition,
} from '@/api/competition';
import { ApiClientError } from '@/api/client';
import { formatTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { useCompetitionOutlet } from './CompetitionLayout';

export function CompetitionOverviewPage() {
  const { competition: c, phase } = useCompetitionOutlet();
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [code, setCode] = useState('');

  const registerMut = useMutation({
    mutationFn: () => registerCompetition(c.id, code.trim() || undefined),
    onSuccess: () => {
      setCode('');
      qc.invalidateQueries({ queryKey: ['competition', c.id] });
      toast.success(i18n.t('报名成功'));
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('报名失败')),
  });
  const unregisterMut = useMutation({
    mutationFn: () => unregisterCompetition(c.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['competition', c.id] });
      toast.success(i18n.t('已取消报名'));
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('取消报名失败')),
  });

  const boundCount = c.boundChallengeCount ?? c.challenges?.length ?? 0;

  return (
    <div className="space-y-8">
      <dl className="grid border-y border-rule divide-y divide-rule sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <Fact label={i18n.t('赛制')} value={
          c.scoringMode === 'fixed'
            ? i18n.t('固定分值')
            : c.scoringMode === 'three_blood'
              ? i18n.t('三血加成')
              : i18n.t('动态分值')
        } />
        <Fact label={i18n.t('赛题')} value={boundCount > 0 ? i18n.t('{{v0}} 道', { v0: boundCount }) : i18n.t('全部公开题目')} />
        <Fact label={i18n.t('报名')} value={i18n.t('{{v0}} 人', { v0: c.registrationCount ?? 0 })} />
      </dl>

      {c.scoreboardFrozen && c.freezeAt && (
        <p className="border-l-2 border-amber pl-3 text-2xs text-ink-2">{i18n.t('封榜中：公开榜单停留在 {{v0}}，封榜后的提交仍计入最终成绩。', { v0: formatTime(c.freezeAt) })}</p>
      )}

      <section className="border border-rule rounded-sm p-4 bg-paper-2/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-ink">{i18n.t('赛事报名')}</h2>
            <p className="mt-1 text-2xs text-ink-3">
              {i18n.t('{{v0}} 人已报名', { v0: c.registrationCount ?? 0 })}
              {c.registrationRequired
                ? i18n.t(' · 需报名后才能提交赛事题与参与答疑')
                : i18n.t(' · 报名可选')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {c.registered ? (
              <>
                <Badge tone="success">{i18n.t('已报名')}</Badge>
                {!c.archivedAt && (phase === 'upcoming' || phase === 'unscheduled') && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    loading={unregisterMut.isPending}
                    onClick={() => unregisterMut.mutate()}
                  >
                    {i18n.t('取消报名')}
                  </Button>
                )}
              </>
            ) : phase === 'live' || phase === 'ended' || c.archivedAt ? (
              <span className="text-2xs text-ink-3">{i18n.t('报名已结束')}</span>
            ) : !user ? (
              <Link
                to="/auth/login"
                className="text-sm font-medium text-amber hover:no-underline"
              >
                {i18n.t('登录后报名')}
              </Link>
            ) : (
              <>
                {c.hasRegistrationCode && c.registrationRequired && (
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder={i18n.t('报名码')}
                    aria-label={i18n.t('报名码')}
                    className="w-40"
                  />
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  loading={registerMut.isPending}
                  disabled={!!c.hasRegistrationCode && c.registrationRequired && !code.trim()}
                  onClick={() => registerMut.mutate()}
                >
                  {i18n.t('报名')}
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      <section>
        <div className="border-b border-rule pb-2 mb-4">
          <h2 className="text-sm font-medium text-ink">{i18n.t('赛事说明')}</h2>
        </div>
        {c.description ? (
          <div className="max-w-prose">
            <Markdown>{c.description}</Markdown>
          </div>
        ) : (
          <p className="text-sm text-ink-3">{i18n.t('这场赛事没有附加说明。')}</p>
        )}
      </section>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link to="challenges" className="font-medium text-amber hover:no-underline">
          {i18n.t('查看赛题')}
        </Link>
        <Link to="scoreboard" className="font-medium text-amber hover:no-underline">
          {i18n.t('查看赛事榜')}
        </Link>
        <Link to="announcements" className="font-medium text-amber hover:no-underline">
          {i18n.t('查看公告')}
        </Link>
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3">
      <dt className="font-mono text-2xs text-ink-3">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink tabular-nums">{value}</dd>
    </div>
  );
}
