import type { AuthUser } from '../types/auth';

/**
 * Flip to `false` to restore real login + JWT flow.
 * When `true`, all protected routes are open and API calls send a dummy Bearer token.
 */
export const SKIP_AUTH_FOR_TESTING = false;

/** Hardcoded user for UI + role-based routes (worker sees worker pages). */
export const TEST_USER: AuthUser = {
  id:           '00000000-0000-4000-8000-000000000001',
  email:        'test@fairgig.local',
  displayName:  'Test Worker',
  role:         'worker',
  cityZoneId:   null,
  cityZoneName: 'DHA',
};

/** Placeholder strings — backend will reject unless you mock; enough for frontend-only testing. */
export const TEST_ACCESS_TOKEN  = 'dev-test-access-token';
export const TEST_REFRESH_TOKEN = 'dev-test-refresh-token';
