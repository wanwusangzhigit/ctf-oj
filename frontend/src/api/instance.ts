import { apiGet, apiPost, apiDelete } from './client';
import type { Instance, StartInstanceResult } from '@/types';

export function startInstance(challengeId: number): Promise<StartInstanceResult> {
  return apiPost<StartInstanceResult>(`/challenges/${challengeId}/instance`);
}

export function getActiveInstance(challengeId: number): Promise<Instance | null> {
  return apiGet<Instance>(`/challenges/${challengeId}/instance`);
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
