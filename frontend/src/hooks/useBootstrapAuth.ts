import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth';
import { useSiteStore } from '@/stores/site';
import { getMe } from '@/api/user';
import { ApiClientError, hasSessionCookie } from '@/api/client';

export function useBootstrapAuth() {
  const setHydrated = useAuthStore((s) => s.setUser);
  const clear = useAuthStore((s) => s.clear);
  const loadSettings = useSiteStore((s) => s.load);
  const hasSession = hasSessionCookie();

  const query = useQuery({
    queryKey: ['auth-me'],
    queryFn: () => getMe(),
    enabled: hasSession,
    retry: false,
    staleTime: 5 * 60_000,
  });

  // Hydrate site settings on first paint — independent of auth state.
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!hasSession) {
      setHydrated(null);
      return;
    }
    if (query.isSuccess) {
      setHydrated(query.data);
    } else if (query.isError) {
      const err = query.error;
      if (err instanceof ApiClientError && (err.code === 40100 || err.code === 40310)) {
        clear();
      } else {
        setHydrated(useAuthStore.getState().user);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, query.data, query.isError, hasSession]);
}
