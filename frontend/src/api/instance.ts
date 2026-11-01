import { apiGet, apiPost, apiDelete } from './client';
import type { Instance, StartInstanceResult } from '@/types';

export function startInstance(
  challengeId: number,
  competitionId?: number,
): Promise<StartInstanceResult> {
  return apiPost<StartInstanceResult>(
    `/challenges/${challengeId}/instance`,
    undefined,
    competitionId ? { competition_id: competitionId } : undefined,
  );
}

export function restartInstance(
  challengeId: number,
  competitionId?: number,
): Promise<StartInstanceResult> {
  return apiPost<StartInstanceResult>(
    `/challenges/${challengeId}/instance/restart`,
    undefined,
    competitionId ? { competition_id: competitionId } : undefined,
  );
}

export function getActiveInstance(
  challengeId: number,
  competitionId?: number,
): Promise<Instance | null> {
  return apiGet<Instance | null>(`/challenges/${challengeId}/instance`, {
    competition_id: competitionId,
  }).then((i) => i ?? null);
}

export function extendInstance(
  challengeId: number,
  instanceId: number,
  ttlSeconds = 3600,
): Promise<Instance> {
  return apiPost<Instance>(
    `/challenges/${challengeId}/instance/${instanceId}/extend`,
    { ttlSeconds },
  );
}

export function stopInstance(challengeId: number, instanceId: number): Promise<void> {
  return apiDelete<void>(`/challenges/${challengeId}/instance/${instanceId}`);
}

export function listMyInstances(): Promise<Instance[]> {
  return apiGet<Instance[]>('/instances/me');
}
