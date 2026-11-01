import type { Competition } from '@/types';

export type CompetitionPhase = 'upcoming' | 'live' | 'ended' | 'unscheduled';

export function competitionPhase(c: Competition, now = Date.now()): CompetitionPhase {
  if (!c.startAt && !c.endAt) return 'unscheduled';
  const start = c.startAt ? Date.parse(c.startAt) : -Infinity;
  const end = c.endAt ? Date.parse(c.endAt) : Infinity;
  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'live';
}

export const COMPETITION_PHASE_LABEL: Record<CompetitionPhase, string> = {
  upcoming: '即将开始',
  live: '进行中',
  ended: '已结束',
  unscheduled: '未排期',
};

export const COMPETITION_PHASE_TONE: Record<
  CompetitionPhase,
  'accent' | 'neutral' | 'warning' | 'success'
> = {
  upcoming: 'neutral',
  live: 'success',
  ended: 'neutral',
  unscheduled: 'warning',
};

export function competitionCoversChallenge(c: Competition, challengeId: number): boolean {
  const bound = c.boundChallengeCount ?? c.challenges?.length ?? 0;
  if (bound === 0) return true;
  return c.challenges?.some((ch) => ch.id === challengeId) ?? false;
}
