import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import { loadStoredTokens } from '@/api/client';
import type { ReactNode } from 'react';

export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const tokens = loadStoredTokens();
  const location = useLocation();
  if (!user || !tokens?.accessToken) {
    return <Navigate to="/auth/login" state={{ from: location.pathname }} replace />;
  }
  return <>{children}</>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user || user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (user) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export function Layout() {
  return (
    <Outlet />
  );
}
