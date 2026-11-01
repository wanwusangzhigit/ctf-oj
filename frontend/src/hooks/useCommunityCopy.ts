import { useQuery } from '@tanstack/react-query';
import { getCommunityMeta } from '@/api/community';
import { resolveCopy, type CommunityCopy } from '@/lib/communityCopy';

// Shares the ['community-meta'] cache entry with every other community hook, so
// resolving copy never costs an extra request.
export function useCommunityCopy() {
  const query = useQuery({
    queryKey: ['community-meta'],
    queryFn: getCommunityMeta,
    staleTime: 30_000,
  });
  const meta = query.data;
  const copy: CommunityCopy = resolveCopy(meta?.copy);

  return {
    meta,
    copy,
    isLoading: query.isLoading,
    isError: !meta || query.isError,
  };
}
