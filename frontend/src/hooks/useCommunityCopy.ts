import { useQuery } from '@tanstack/react-query';
import { getCommunityMeta } from '@/api/community';
import { resolveCopy, type CommunityCopy } from '@/lib/communityCopy';
import type { CommunitySectionView } from '@/types';

// Shares the ['community-meta'] cache entry with every other community hook, so
// resolving copy never costs an extra request. Boards travel on the same
// payload: they are read whenever copy is, so this hook must not add a query.
export function useCommunityCopy() {
  const query = useQuery({
    queryKey: ['community-meta'],
    queryFn: getCommunityMeta,
    staleTime: 30_000,
  });
  const meta = query.data;
  const copy: CommunityCopy = resolveCopy(meta?.copy);
  const sections: CommunitySectionView[] = meta?.sections ?? [];

  return {
    meta,
    copy,
    sections,
    sectionById: (id: number) => sections.find((s) => s.id === id),
    isLoading: query.isLoading,
    isError: !meta || query.isError,
  };
}
