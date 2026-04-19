import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { getEnv } from '../config/env';
import { useAuthStore } from '../stores/authStore';
import {
  SKIP_AUTH_FOR_TESTING,
  TEST_ACCESS_TOKEN,
  TEST_REFRESH_TOKEN,
} from '../config/testAuth';

function getAccessToken(): string | null {
  if (SKIP_AUTH_FOR_TESTING) return TEST_ACCESS_TOKEN;
  return useAuthStore.getState().accessToken;
}

function getRefreshToken(): string | null {
  if (SKIP_AUTH_FOR_TESTING) return TEST_REFRESH_TOKEN;
  return useAuthStore.getState().refreshToken;
}

const { resolved: BASE_URLS } = getEnv();

/** Single in-flight refresh — concurrent 401s share one refresh call. */
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(new Error('No refresh token'));
  }
  refreshPromise = (async () => {
    try {
      const { data } = await axios.post<{ access_token: string }>(
        `${BASE_URLS.VITE_AUTH_URL}/api/auth/refresh`,
        { refresh_token: refreshToken },
      );
      useAuthStore.getState().setAccessToken(data.access_token);
      return data.access_token;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

const unauthorizedListeners = new Set<() => void>();

/** Subscribe to auth failures (no refresh possible or refresh failed). Returns unsubscribe. */
export function onUnauthorized(cb: () => void): () => void {
  unauthorizedListeners.add(cb);
  return () => unauthorizedListeners.delete(cb);
}

function notifyUnauthorized(): void {
  if (unauthorizedListeners.size > 0) {
    unauthorizedListeners.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  } else {
    window.location.replace('/login');
  }
}

function requestId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function createClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15_000,
  });

  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    config.headers['X-Request-Id'] = requestId();
    return config;
  });

  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 401 && !original._retry) {
        if (SKIP_AUTH_FOR_TESTING) {
          return Promise.reject(error);
        }

        original._retry = true;
        const rt = getRefreshToken();
        if (!rt) {
          useAuthStore.getState().clearAuth();
          notifyUnauthorized();
          return Promise.reject(error);
        }

        try {
          const access = await refreshAccessToken();
          original.headers.Authorization = `Bearer ${access}`;
          return client(original);
        } catch {
          useAuthStore.getState().clearAuth();
          notifyUnauthorized();
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    },
  );

  return client;
}

export const authClient = createClient(BASE_URLS.VITE_AUTH_URL);
export const earningsClient = createClient(BASE_URLS.VITE_EARNINGS_URL);
export const anomalyClient = createClient(BASE_URLS.VITE_ANOMALY_URL);
export const grievanceClient = createClient(BASE_URLS.VITE_GRIEVANCE_URL);
export const analyticsClient = createClient(BASE_URLS.VITE_ANALYTICS_URL);
export const certificateClient = createClient(BASE_URLS.VITE_CERTIFICATE_URL);
