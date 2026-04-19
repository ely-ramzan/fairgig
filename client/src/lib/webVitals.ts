/** Pluggable Web Vitals sink — no-op until you wire analytics. */
export function reportWebVital(metric: { name: string; value: number; id: string }): void {
  if (import.meta.env.DEV) {
    void metric;
  }
}
