// NOTE: keep this import type-only to prevent a runtime circular dependency
// between env.ts and runtimeConfig.ts.
import type { ServiceKey } from './env';

/**
 * Runtime-sourced service URL map.
 *
 * Loaded once during app bootstrap from (in order):
 *   1. GET /api/config     — Vercel serverless, reads env vars at request time
 *   2. GET /config.json    — static fallback shipped with the build
 *
 * Either source is optional. On any failure we silently fall back so build-time
 * env vars (VITE_*) remain the final baseline.
 */

export type RuntimeServiceMap = Partial<Record<ServiceKey, string>>;

interface ConfigResponse {
  source?: string;
  services?: Record<string, unknown>;
}

let snapshot: RuntimeServiceMap = {};

function sanitize(raw: Record<string, unknown> | undefined): RuntimeServiceMap {
  if (!raw) return {};
  const out: RuntimeServiceMap = {};
  const keys: ServiceKey[] = [
    'auth',
    'earnings',
    'anomaly',
    'grievance',
    'analytics',
    'certificate',
  ];
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string') {
      const trimmed = v.trim().replace(/\/+$/, '');
      if (trimmed === '' || /^https?:\/\//.test(trimmed)) {
        out[k] = trimmed;
      }
    }
  }
  return out;
}

async function fetchJson(url: string, timeoutMs: number): Promise<ConfigResponse | null> {
  if (typeof fetch === 'undefined') return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as ConfigResponse;
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Returns the runtime map loaded during bootstrap. Empty before loadRuntimeConfig() resolves. */
export function getRuntimeConfig(): RuntimeServiceMap {
  return snapshot;
}

/**
 * Load runtime config from /api/config, then /config.json as a fallback.
 * Safe to call once at app start. Never throws.
 */
export async function loadRuntimeConfig(): Promise<RuntimeServiceMap> {
  const api = await fetchJson('/api/config', 3000);
  const apiMap = sanitize(api?.services as Record<string, unknown> | undefined);
  if (Object.values(apiMap).some((v) => v && v.length > 0)) {
    snapshot = apiMap;
    return snapshot;
  }

  const staticCfg = await fetchJson('/config.json', 2000);
  const staticMap = sanitize(staticCfg?.services as Record<string, unknown> | undefined);
  if (Object.values(staticMap).some((v) => v && v.length > 0)) {
    snapshot = staticMap;
    return snapshot;
  }

  snapshot = {};
  return snapshot;
}
