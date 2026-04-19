/** Sentry stub — set VITE_SENTRY_DSN to enable a real SDK in production. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (import.meta.env.DEV) {
    void context;
    console.error('[captureException]', error);
  }
}
