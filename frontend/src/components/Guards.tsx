import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { canAccessAdmin, hasDelegation, hasPermission, type Permission } from '@/lib/permissions';
import { useAuthStore } from '@/stores/auth';
import { Spinner } from '@/components/ui';
import type { ReactNode } from 'react';

/**
 * Auth guards wait for the post-refresh /users/me probe to finish before
 * deciding. Without this, RequireAuth would redirect to /auth/login while
 * the user store is briefly empty on first paint, and PublicOnly would then
 * bounce back to "/" once hydration completes — manifesting as "refresh on
 * /challenges/5 jumps to home".
 */
function HydrationGate({ children }: { children: ReactNode }) {
  const hydrated = useAuthStore((s) => s.hydrated);
  if (!hydrated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }
  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  return (
    <HydrationGate>
      {!user ? (
        <Navigate
          to={`/auth/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
          replace
        />
      ) : (
        <>{children}</>
      )}
    </HydrationGate>
  );
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  return (
    <HydrationGate>
      {!canAccessAdmin(user) ? <Navigate to="/" replace /> : <>{children}</>}
    </HydrationGate>
  );
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const user = useAuthStore((s) => s.user);

  return (
    <HydrationGate>
      {!hasPermission(user, permission) ? (
        <Navigate to="/admin" replace />
      ) : (
        <>{children}</>
      )}
    </HydrationGate>
  );
}

export function RequireChallengeManage({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const { id } = useParams<{ id: string }>();
  const challengeId = Number(id);

  const delegated = Number.isFinite(challengeId)
    ? hasDelegation(user, 'challenge', 'manage', challengeId)
    : hasDelegation(user, 'challenge');

  return (
    <HydrationGate>
      {hasPermission(user, 'challenge.manage') || delegated ? (
        <>{children}</>
      ) : (
        <Navigate to="/admin" replace />
      )}
    </HydrationGate>
  );
}

export function RequireCompetitionManage({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);

  return (
    <HydrationGate>
      {hasPermission(user, 'competition.manage') ||
      hasDelegation(user, 'competition') ? (
        <>{children}</>
      ) : (
        <Navigate to="/admin" replace />
      )}
    </HydrationGate>
  );
}

export function AdminIndexRedirect() {
  const user = useAuthStore((s) => s.user);
  const order: [Permission, string][] = [
    ['admin.overview', '/admin/overview'],
    ['challenge.manage', '/admin/challenges'],
    ['competition.manage', '/admin/competitions'],
    ['announcement.manage', '/admin/announcements'],
    ['community.manage', '/admin/community'],
    ['server.manage', '/admin/server'],
  ];
  const hit = order.find(([perm]) => hasPermission(user, perm));
  if (hit) return <Navigate to={hit[1]} replace />;
  if (hasDelegation(user, 'challenge')) {
    return <Navigate to="/admin/challenges" replace />;
  }
  if (hasDelegation(user, 'competition')) {
    return <Navigate to="/admin/competitions" replace />;
  }
  return <Navigate to="/" replace />;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  return (
    <HydrationGate>
      {user ? (
        <Navigate to={safeRedirect(new URLSearchParams(location.search).get('redirect'))} replace />
      ) : (
        <>{children}</>
      )}
    </HydrationGate>
  );
}

export function safeRedirect(raw: string | null | undefined): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return '/';
  return raw;
}

export function Layout() {
  return <Outlet />;
}
