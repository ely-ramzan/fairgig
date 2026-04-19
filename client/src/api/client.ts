import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { getEnv, isServiceConfigured, type ServiceKey } from '../config/env';
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

const BASE_URLS = getEnv().resolved;

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
        `${BASE_URLS.auth}/api/auth/refresh`,
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

/**
 * A lightweight proxy axios instance that always throws a clear "service not configured"
 * error so calling code fails fast with a helpful message instead of making garbage requests.
 */
function createUnavailableClient(service: ServiceKey): AxiosInstance {
  const client = axios.create({ baseURL: '' });
  client.interceptors.request.use(() => {
    const err = new Error(
      `${service} service is not configured. Set VITE_${service.toUpperCase()}_URL or use the Service Settings page.`,
    );
    (err as Error & { code?: string }).code = 'SERVICE_UNAVAILABLE';
    return Promise.reject(err);
  });
  return client;
}

function createClient(service: ServiceKey): AxiosInstance {
  if (!isServiceConfigured(service)) {
    return createUnavailableClient(service);
  }
  const baseURL = BASE_URLS[service];
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

export const authClient = createClient('auth');
export const earningsClient = createClient('earnings');
export const anomalyClient = createClient('anomaly');
export const grievanceClient = createClient('grievance');
export const analyticsClient = createClient('analytics');
export const certificateClient = createClient('certificate');
