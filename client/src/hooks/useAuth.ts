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
    staleTime: Infinity,
  });
}

export function useLogin() {
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: (payload: { email: string; password: string }) =>
      authApi.login(payload).then((r) => r.data),
    onSuccess: async (data) => {
      // Fetch full user profile immediately after login
      const me = await authApi.me().then((r) => r.data);
      setAuth(me as AuthUser, data.access_token, data.refresh_token);
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
