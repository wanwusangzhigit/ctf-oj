import { apiGet, apiPost, apiPut, apiDelete } from './client';
import type { Hint, HintView } from '@/types';

/** Public — list hints for a challenge (content masked until unlocked). */
export function listHints(challengeId: number): Promise<HintView[]> {
  return apiGet<HintView[]>(`/challenges/${challengeId}/hints`);
}

/** Authenticated — unlock a hint for the current user. Idempotent. */
export function unlockHint(challengeId: number, hintId: number): Promise<{ ok: true }> {
  return apiPost<{ ok: true }>(`/challenges/${challengeId}/hints/${hintId}/unlock`);
}

/** Admin — list all hints for a challenge with full content. */
export function adminListHints(challengeId: number): Promise<Hint[]> {
  return apiGet<Hint[]>(`/admin/challenges/${challengeId}/hints`);
}

export interface HintInput {
  sortOrder: number;
  costRatio: number;
  content: string;
}

export function adminCreateHint(challengeId: number, input: HintInput): Promise<Hint> {
  return apiPost<Hint>(`/admin/challenges/${challengeId}/hints`, input);
}

export function adminUpdateHint(hintId: number, input: HintInput): Promise<Hint> {
  return apiPut<Hint>(`/admin/challenges/hints/${hintId}`, input);
}

export function adminDeleteHint(hintId: number): Promise<{ ok: true }> {
  return apiDelete<{ ok: true }>(`/admin/challenges/hints/${hintId}`);
}
