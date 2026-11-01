import { useQuery } from '@tanstack/react-query';
import { listCompetitions } from '@/api/competition';

/**
 * Rows shown across the competition admin screens. `scope=admin` returns every
 * competition to global managers and only the delegated ones to resource
 * admins, so both roles can share one cached query — the sub-routes read the
 * row they need out of it instead of refetching a detail endpoint a delegate may
 * not be allowed to hit.
 */
export function useAdminCompetitions() {
  return useQuery({
    queryKey: ['admin-competitions'],
    queryFn: () => listCompetitions(1, 100, 'admin'),
    staleTime: 30_000,
  });
}

export function useAdminCompetition(competitionId: number) {
  const query = useAdminCompetitions();
  const competition = (query.data?.items ?? []).find((c) => c.id === competitionId);
  return { query, competition };
}
