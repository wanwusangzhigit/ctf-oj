import { apiGet } from './client';
import type { SearchHit } from '@/types';

export function search(q: string, limit = 5): Promise<SearchHit[]> {
  return apiGet<SearchHit[]>('/search', { q, limit });
}
