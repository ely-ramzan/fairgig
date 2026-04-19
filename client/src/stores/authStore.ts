import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import {
  SKIP_AUTH_FOR_TESTING,
  TEST_USER,
  TEST_ACCESS_TOKEN,
} from '../config/testAuth';
import type { AuthUser, UserRole } from '../types/auth';

export type { AuthUser, UserRole } from '../types/auth';

interface AuthState {
  user:         AuthUser | null;
  accessToken:  string | null;
  refreshToken: string | null;
  // Guards against flash-of-unauthenticated-content on page load.
  // Set to true once Zustand has hydrated from localStorage.
  rehydrated:   boolean;

  setAuth:        (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setAccessToken: (token: string) => void;
  clearAuth:      () => void;
  setRehydrated:  () => void;
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user:         null,
        accessToken:  null,
        refreshToken: null,
        rehydrated:   false,

        setAuth: (user, accessToken, refreshToken) =>
          set({ user, accessToken, refreshToken }, false, 'auth/setAuth'),

        setAccessToken: (token) =>
          set({ accessToken: token }, false, 'auth/refreshToken'),

        clearAuth: () =>
          set(
            { user: null, accessToken: null, refreshToken: null },
            false,
            'auth/logout',
          ),

        setRehydrated: () =>
          set({ rehydrated: true }, false, 'auth/rehydrated'),
      }),
      {
        name:    'fg-auth',
        storage: createJSONStorage(() => localStorage),
        // Only persist auth data — never persist transient UI state
        partialize: (state) => ({
          user:         state.user,
          accessToken:  state.accessToken,
          refreshToken: state.refreshToken,
        }),
        onRehydrateStorage: () => (state) => {
          state?.setRehydrated();
        },
      },
    ),
    { name: 'AuthStore' },
  ),
);

// ── Selectors ─────────────────────────────────────────────────────────────────

export function useIsAuthenticated(): boolean {
  const ok = useAuthStore((s) => !!s.accessToken && !!s.user);
  return SKIP_AUTH_FOR_TESTING || ok;
}

export function useCurrentUser(): AuthUser | null {
  const user = useAuthStore((s) => s.user);
  return SKIP_AUTH_FOR_TESTING ? TEST_USER : user;
}

export function useUserRole(): UserRole | null {
  const role = useAuthStore((s) => s.user?.role ?? null);
  return SKIP_AUTH_FOR_TESTING ? TEST_USER.role : role;
}

export function useAccessToken(): string | null {
  const token = useAuthStore((s) => s.accessToken);
  return SKIP_AUTH_FOR_TESTING ? TEST_ACCESS_TOKEN : token;
}

export function useRehydrated(): boolean {
  const done = useAuthStore((s) => s.rehydrated);
  return SKIP_AUTH_FOR_TESTING || done;
}
