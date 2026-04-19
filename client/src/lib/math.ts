// Commission rate and earnings calculation utilities.

export function commissionRate(gross: number, deductions: number): number {
  if (gross <= 0) return 0;
  return (deductions / gross) * 100;
}

export function effectiveHourlyRate(net: number, hours: number): number {
  if (hours <= 0) return 0;
  return net / hours;
}

export function netFromGross(gross: number, rate: number): number {
  return gross * (1 - rate / 100);
}

export function momChangePct(prev: number, curr: number): number {
  if (prev <= 0) return 0;
  return ((curr - prev) / prev) * 100;
}

export function isVulnerable(prev: number, curr: number): boolean {
  return momChangePct(prev, curr) <= -20;
}
