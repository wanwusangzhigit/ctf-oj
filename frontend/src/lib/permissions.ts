import i18n from '@/locales/i18n';
import type { AccessPermission, Delegation, Role, User } from '@/types';

export type Permission =
  | 'admin.overview'
  | 'challenge.manage'
  | 'challenge.export'
  | 'category.manage'
  | 'competition.manage'
  | 'competition.export'
  | 'user.manage'
  | 'announcement.manage'
  | 'discussion.moderate'
  | 'community.manage'
  | 'settings.manage'
  | 'audit.view'
  | 'instance.manage'
  | 'broadcast.send'
  | 'server.manage';

// Getters resolve the active language at read time so call sites stay unchanged.
export const ROLE_LABEL: Record<Role, string> = {
  get user() { return i18n.t('enums.role.user'); },
  get challenge_admin() { return i18n.t('enums.role.challengeAdmin'); },
  get competition_admin() { return i18n.t('enums.role.competitionAdmin'); },
  get moderator() { return i18n.t('enums.role.moderator'); },
  get admin() { return i18n.t('enums.role.admin'); },
};

const ROLE_FALLBACK: Record<string, Permission[]> = {
  admin: [
    'admin.overview',
    'challenge.manage',
    'challenge.export',
    'category.manage',
    'competition.manage',
    'competition.export',
    'user.manage',
    'announcement.manage',
    'discussion.moderate',
    'community.manage',
    'settings.manage',
    'audit.view',
    'instance.manage',
    'broadcast.send',
    'server.manage',
  ],
  challenge_admin: ['challenge.manage', 'challenge.export', 'category.manage'],
  competition_admin: ['competition.manage', 'competition.export'],
  moderator: ['announcement.manage', 'discussion.moderate'],
};

export function hasPermission(
  user: User | null | undefined,
  permission: Permission,
): boolean {
  if (!user) return false;
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions.includes(permission);
  }
  return (ROLE_FALLBACK[user.role] ?? []).includes(permission);
}

export function hasDelegation(
  user: User | null | undefined,
  resourceType: Delegation['resourceType'],
  permission: AccessPermission = 'manage',
  resourceId?: number,
): boolean {
  if (!user?.delegations) return false;
  return user.delegations.some(
    (d) =>
      d.resourceType === resourceType &&
      d.permission === permission &&
      (resourceId === undefined || d.resourceId === resourceId),
  );
}

export function canAccessAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.permissions && user.permissions.length > 0) return true;
  return hasDelegation(user, 'challenge') || hasDelegation(user, 'competition');
}
