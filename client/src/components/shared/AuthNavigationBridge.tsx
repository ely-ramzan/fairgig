import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onUnauthorized } from '../../api/client';

/** Bridges axios 401 → React Router (SPA) instead of full page reload. */
export function AuthNavigationBridge() {
  const navigate = useNavigate();
  useEffect(() => {
    return onUnauthorized(() => {
      navigate('/login?expired=1', { replace: true });
    });
  }, [navigate]);
  return null;
}
