import { z } from 'zod';

const urlOrEmpty = z
  .string()
  .optional()
  .transform((v) => v ?? '')
  .refine((v) => v === '' || /^https?:\/\//.test(v), 'Must be http(s) URL or empty for defaults');

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

const DEFAULTS = {
  VITE_AUTH_URL: 'http://localhost:8001',
  VITE_EARNINGS_URL: 'http://localhost:8002',
  VITE_ANOMALY_URL: 'http://localhost:8003',
  VITE_GRIEVANCE_URL: 'http://localhost:8004',
  VITE_ANALYTICS_URL: 'http://localhost:8005',
  VITE_CERTIFICATE_URL: 'http://localhost:8006',
} as const;

/** Validated env; throws on invalid shape in development. */
export function loadEnv(): AppEnv & {
  resolved: Record<keyof typeof DEFAULTS, string>;
} {
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
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    if (import.meta.env.DEV) {
      console.error('[env]', msg);
    }
    throw new Error(`Invalid environment: ${msg}`);
  }
  const d = parsed.data;
  const resolved = {
    VITE_AUTH_URL: d.VITE_AUTH_URL || DEFAULTS.VITE_AUTH_URL,
    VITE_EARNINGS_URL: d.VITE_EARNINGS_URL || DEFAULTS.VITE_EARNINGS_URL,
    VITE_ANOMALY_URL: d.VITE_ANOMALY_URL || DEFAULTS.VITE_ANOMALY_URL,
    VITE_GRIEVANCE_URL: d.VITE_GRIEVANCE_URL || DEFAULTS.VITE_GRIEVANCE_URL,
    VITE_ANALYTICS_URL: d.VITE_ANALYTICS_URL || DEFAULTS.VITE_ANALYTICS_URL,
    VITE_CERTIFICATE_URL: d.VITE_CERTIFICATE_URL || DEFAULTS.VITE_CERTIFICATE_URL,
  };
  return { ...d, resolved };
}

let cached: ReturnType<typeof loadEnv> | null = null;

export function getEnv(): ReturnType<typeof loadEnv> {
  if (!cached) cached = loadEnv();
  return cached;
}
