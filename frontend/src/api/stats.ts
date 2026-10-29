import { apiGet } from './client';
import type { Achievement, CategoryStat, Overview, PodiumEntry, RecentSolve, SubmissionTrendPoint, TrendPoint } from '@/types';

export function overview(): Promise<Overview> {
  return apiGet<Overview>('/stats/overview');
}

export function byCategory(): Promise<CategoryStat[]> {
  return apiGet<CategoryStat[]>('/stats/category');
}

export function solveTrend(days = 30): Promise<TrendPoint[]> {
  return apiGet<TrendPoint[]>('/stats/trend', { days });
}

export function recentSolves(limit = 20): Promise<RecentSolve[]> {
  return apiGet<RecentSolve[]>('/stats/recent', { limit });
}

export function submissionTrend(days = 30): Promise<SubmissionTrendPoint[]> {
  return apiGet<SubmissionTrendPoint[]>('/stats/submissions/trend', { days });
}

export function firstBloods(limit = 20): Promise<RecentSolve[]> {
  return apiGet<RecentSolve[]>('/stats/first-bloods', { limit });
}

export function challengePodium(challengeId: number): Promise<PodiumEntry[]> {
  return apiGet<PodiumEntry[]>(`/challenges/${challengeId}/podium`);
}

export function userActivity(userId: number, days = 365): Promise<{ date: string; count: number }[]> {
  return apiGet(`/users/${userId}/activity`, { days });
}

export function userAchievements(userId: number): Promise<Achievement[]> {
  return apiGet(`/users/${userId}/achievements`);
}
