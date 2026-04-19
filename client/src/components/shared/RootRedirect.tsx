import { Navigate } from 'react-router-dom';
import {
  useIsAuthenticated,
  useRehydrated,
  useUserRole,
} from '../../stores/authStore';
import { SKIP_AUTH_FOR_TESTING } from '../../config/testAuth';
import { roleHome } from '../../lib/roleHome';

/**
 * Resolves `/` based on auth state:
 *   - dev skip-auth:       → /dev (screen map)
 *   - auth store hydrated, signed in: role-appropriate home
 *   - signed out:          → /landing
 */
export function RootRedirect() {
  const rehydrated = useRehydrated();
  const isAuthed = useIsAuthenticated();
  const role = useUserRole();

  if (SKIP_AUTH_FOR_TESTING) {
    return <Navigate to="/dev" replace />;
  }

  // Wait for persisted auth to load before deciding.
  if (!rehydrated) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--fg-bg)',
          fontFamily: 'var(--fg-font-mono)',
          fontSize: 10,
          letterSpacing: '0.15em',
          color: 'var(--fg-t4)',
          textTransform: 'uppercase',
        }}
      >
        FAIRGIG
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/landing" replace />;
  }

  return <Navigate to={roleHome(role)} replace />;
}
