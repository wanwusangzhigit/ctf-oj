import i18n from '@/locales/i18n';
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

// Getters resolve the active language at read time so call sites stay unchanged.
export const COMPETITION_PHASE_LABEL: Record<CompetitionPhase, string> = {
  get upcoming() { return i18n.t('enums.phase.upcoming'); },
  get live() { return i18n.t('enums.phase.live'); },
  get ended() { return i18n.t('enums.phase.ended'); },
  get unscheduled() { return i18n.t('enums.phase.unscheduled'); },
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
