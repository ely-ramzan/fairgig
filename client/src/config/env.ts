import { z } from 'zod';
import { getRuntimeConfig } from './runtimeConfig';

/**
 * Service base URL configuration.
 *
 * Resolution order (highest priority first):
 *   1. localStorage override        — set via /settings/services (per-browser)
 *   2. Runtime config (/api/config) — loaded at bootstrap, reads Vercel env at request time
 *   3. Runtime static (/config.json) — editable asset shipped with the build
 *   4. Vite build-time VITE_*_URL   — from client/.env
 *   5. empty                        — service is "unavailable"; UI degrades gracefully
 *
 * Empty strings are valid — code that talks to a service guards on
 * `isServiceConfigured(service)` before calling.
 */

const urlOrEmpty = z
  .string()
  .trim()
  .optional()
  .transform((v) => v ?? '')
  .refine(
    (v) => v === '' || /^https?:\/\/[^\s]+$/.test(v),
    'Must be an http(s) URL or empty',
  );

const envSchema = z.object({
  VITE_AUTH_URL: urlOrEmpty,
  VITE_EARNINGS_URL: urlOrEmpty,
  VITE_ANOMALY_URL: urlOrEmpty,
  VITE_GRIEVANCE_URL: urlOrEmpty,
  VITE_ANALYTICS_URL: urlOrEmpty,
  VITE_CERTIFICATE_URL: urlOrEmpty,
  VITE_SENTRY_DSN: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export type ServiceKey =
  | 'auth'
  | 'earnings'
  | 'anomaly'
  | 'grievance'
  | 'analytics'
  | 'certificate';

const ENV_KEY_BY_SERVICE: Record<ServiceKey, keyof AppEnv> = {
  auth: 'VITE_AUTH_URL',
  earnings: 'VITE_EARNINGS_URL',
  anomaly: 'VITE_ANOMALY_URL',
  grievance: 'VITE_GRIEVANCE_URL',
  analytics: 'VITE_ANALYTICS_URL',
  certificate: 'VITE_CERTIFICATE_URL',
};

const LOCAL_STORAGE_KEY = 'fg-service-urls';

function readOverrides(): Partial<Record<ServiceKey, string>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Partial<Record<ServiceKey, string>> = {};
    for (const key of Object.keys(ENV_KEY_BY_SERVICE) as ServiceKey[]) {
      const v = (parsed as Record<string, unknown>)[key];
      if (typeof v === 'string' && (v === '' || /^https?:\/\//.test(v.trim()))) {
        out[key] = v.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function setServiceOverrides(
  overrides: Partial<Record<ServiceKey, string>>,
): void {
  if (typeof window === 'undefined') return;
  const sanitized: Partial<Record<ServiceKey, string>> = {};
  for (const key of Object.keys(overrides) as ServiceKey[]) {
    const v = overrides[key];
    if (typeof v === 'string') sanitized[key] = v.trim();
  }
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sanitized));
  cached = null;
}

export function clearServiceOverrides(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  cached = null;
}

/** @internal test-only: drop cached env so next call re-reads everything. */
export function _resetEnvCacheForTests(): void {
  cached = null;
}

/**
 * Safely parse Vite env. On failure we degrade to empty strings rather than
 * throwing, so a typo'd env var never bricks a deployed build.
 */
function readViteEnv(): Record<ServiceKey, string> {
  const raw = {
    VITE_AUTH_URL: import.meta.env.VITE_AUTH_URL,
    VITE_EARNINGS_URL: import.meta.env.VITE_EARNINGS_URL,
    VITE_ANOMALY_URL: import.meta.env.VITE_ANOMALY_URL,
    VITE_GRIEVANCE_URL: import.meta.env.VITE_GRIEVANCE_URL,
    VITE_ANALYTICS_URL: import.meta.env.VITE_ANALYTICS_URL,
    VITE_CERTIFICATE_URL: import.meta.env.VITE_CERTIFICATE_URL,
    VITE_SENTRY_DSN: import.meta.env.VITE_SENTRY_DSN,
  };
  const parsed = envSchema.safeParse(raw);
  if (parsed.success) {
    const d = parsed.data;
    return {
      auth: d.VITE_AUTH_URL,
      earnings: d.VITE_EARNINGS_URL,
      anomaly: d.VITE_ANOMALY_URL,
      grievance: d.VITE_GRIEVANCE_URL,
      analytics: d.VITE_ANALYTICS_URL,
      certificate: d.VITE_CERTIFICATE_URL,
    };
  }
  if (import.meta.env.DEV) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    console.warn('[FairGig env] invalid VITE_* env, using empty defaults:', msg);
  }
  return {
    auth: '',
    earnings: '',
    anomaly: '',
    grievance: '',
    analytics: '',
    certificate: '',
  };
}

export function loadEnv(): {
  resolved: Record<ServiceKey, string>;
  overrides: Partial<Record<ServiceKey, string>>;
  runtime: Partial<Record<ServiceKey, string>>;
  envValues: Record<ServiceKey, string>;
} {
  const envValues = readViteEnv();
  const runtime = getRuntimeConfig();
  const overrides = readOverrides();

  const pick = (key: ServiceKey): string => {
    const override = overrides[key];
    if (typeof override === 'string') return override.replace(/\/+$/, '');
    const runtimeVal = runtime[key];
    if (typeof runtimeVal === 'string' && runtimeVal !== '') return runtimeVal.replace(/\/+$/, '');
    return envValues[key].replace(/\/+$/, '');
  };

  const resolved: Record<ServiceKey, string> = {
    auth: pick('auth'),
    earnings: pick('earnings'),
    anomaly: pick('anomaly'),
    grievance: pick('grievance'),
    analytics: pick('analytics'),
    certificate: pick('certificate'),
  };

  return { resolved, overrides, runtime, envValues };
}

let cached: ReturnType<typeof loadEnv> | null = null;

export function getEnv(): ReturnType<typeof loadEnv> {
  if (!cached) cached = loadEnv();
  return cached;
}

export function isServiceConfigured(service: ServiceKey): boolean {
  const url = getEnv().resolved[service];
  return typeof url === 'string' && url.length > 0;
}

export const SERVICE_KEYS: readonly ServiceKey[] = [
  'auth',
  'earnings',
  'anomaly',
  'grievance',
  'analytics',
  'certificate',
] as const;

export const SERVICE_LABELS: Record<ServiceKey, string> = {
  auth: 'Auth',
  earnings: 'Earnings',
  anomaly: 'Anomaly detection',
  grievance: 'Grievances',
  analytics: 'Analytics',
  certificate: 'Certificate',
};
