import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi }       from '../api/auth';
import { useAuthStore }  from '../stores/authStore';
import type { AuthUser } from '../stores/authStore';

export function useMe() {
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn:  () => authApi.me().then((r) => r.data),
    staleTime: Infinity,
  });
}

export function useCityZones() {
  return useQuery({
    queryKey: ['city-zones'],
    queryFn:  () => authApi.cityZones().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const tokens = await authApi.login(payload).then((r) => r.data);
      // IMPORTANT: seed the tokens BEFORE calling /me — the axios request
      // interceptor reads the access token from the store to build the
      // Authorization header. Setting it after /me produced a 401 because
      // the first /me call was unauthenticated.
      useAuthStore.setState({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      try {
        const me = await authApi.me().then((r) => r.data);
        useAuthStore
          .getState()
          .setAuth(me as AuthUser, tokens.access_token, tokens.refresh_token);
        return { tokens, me };
      } catch (err) {
        // Don't leave a half-authed store behind if /me fails.
        useAuthStore.getState().clearAuth();
        throw err;
      }
    },
  });
}

export function useRegister() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (payload: Parameters<typeof authApi.register>[0]) =>
      authApi.register(payload).then((r) => r.data),
    onSuccess: (data) => {
      setAuth(data.user as AuthUser, data.access_token, data.refresh_token);
    },
  });
}

export function useLogout() {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const qc        = useQueryClient();

  return () => {
    clearAuth();
    qc.clear();
    window.location.replace('/login');
  };
}
