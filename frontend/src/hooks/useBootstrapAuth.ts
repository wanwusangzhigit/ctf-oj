import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { getMe } from '@/api/user';
import { loadStoredTokens, clearStoredTokens } from '@/api/client';

export function useBootstrapAuth() {
  const setHydrated = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const tokens = loadStoredTokens();

  const query = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => getMe(),
    enabled: !!tokens?.accessToken,
    retry: false,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!tokens?.accessToken) {
      setHydrated(null);
      return;
    }
    if (query.isSuccess) {
      setHydrated(query.data);
    } else if (query.isError) {
      clear();
      clearStoredTokens();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, query.data, query.isError, tokens?.accessToken]);
}
