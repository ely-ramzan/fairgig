import { Navigate, Outlet } from 'react-router-dom';
import { useIsAuthenticated, useRehydrated, useUserRole } from '../../stores/authStore';
import type { UserRole } from '../../stores/authStore';
import { SKIP_AUTH_FOR_TESTING } from '../../config/testAuth';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const rehydrated      = useRehydrated();
  const isAuthenticated = useIsAuthenticated();
  const role            = useUserRole();

  // Dev-only: bypass login + role checks entirely.
  if (SKIP_AUTH_FOR_TESTING) {
    return <Outlet />;
  }

  // Block render until Zustand has loaded from localStorage.
  // Without this: flash of login page then redirect for already-logged-in users.
  if (!rehydrated) {
    return (
      <div style={{
        height:          '100vh',
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        background:      'var(--fg-bg)',
        fontFamily:      'var(--fg-font-mono)',
        fontSize:        10,
        letterSpacing:   '0.15em',
        color:           'var(--fg-t4)',
        textTransform:   'uppercase',
      }}>
        FAIRGIG
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: window.location.pathname }} />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/403" replace />;
  }

  return <Outlet />;
}
