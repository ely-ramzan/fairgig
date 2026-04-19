import type { UserRole } from '../types/auth';

/** Role-appropriate landing path after login/register. */
export function roleHome(role: UserRole | null | undefined): string {
  switch (role) {
    case 'verifier':
      return '/verify';
    case 'advocate':
      return '/analytics';
    case 'worker':
    default:
      return '/dashboard';
  }
}

/**
 * Path prefixes each role is allowed to land on. Keep in sync with the
 * <ProtectedRoute allowedRoles=…> groupings in App.tsx.
 */
const ROLE_PATHS: Record<UserRole, readonly string[]> = {
  worker: ['/dashboard', '/shifts', '/certificate', '/community'],
  verifier: ['/verify'],
  advocate: ['/analytics', '/community'],
};

/**
 * True if `path` is a post-login destination this role can reach without
 * tripping ProtectedRoute's 403 redirect. Used to sanitize a "return to X"
 * intent captured by ProtectedRoute before the user switched identity.
 */
export function pathAllowedForRole(
  path: string,
  role: UserRole | null | undefined,
): boolean {
  if (!role) return false;
  const prefixes = ROLE_PATHS[role] ?? [];
  return prefixes.some((p) => path === p || path.startsWith(`${p}/`));
}
