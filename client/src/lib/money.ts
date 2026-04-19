/**
 * Money helpers — store/compare as integer cents to avoid IEEE-754 drift.
 */

const PKR_LOCALE = 'en-PK';

export function toCents(input: string | number | null | undefined): bigint {
  if (input === null || input === undefined) return 0n;
  const raw = String(input).trim().replace(/,/g, '');
  if (raw === '' || raw === '-') return 0n;
  const neg = raw.startsWith('-');
  const abs = neg ? raw.slice(1) : raw;
  const [wholePart, fracPart = ''] = abs.split('.');
  const whole = wholePart.replace(/^\D+/, '') || '0';
  const frac = (fracPart + '00').slice(0, 2);
  const cents = BigInt(whole) * 100n + BigInt(frac.padEnd(2, '0'));
  return neg ? -cents : cents;
}

export function fromCents(cents: bigint): string {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const fracStr = frac < 10n ? `0${frac}` : `${frac}`;
  const s = `${whole}.${fracStr}`;
  return neg ? `-${s}` : s;
}

export function formatPKRFromCents(cents: bigint, options?: { compact?: boolean }): string {
  const s = fromCents(cents);
  const n = Number(s);
  if (Number.isNaN(n)) return '—';
  if (options?.compact) {
    return new Intl.NumberFormat(PKR_LOCALE, {
      style: 'currency',
      currency: 'PKR',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat(PKR_LOCALE, {
    style: 'currency',
    currency: 'PKR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export function parseMoneyWire(value: string | number | null | undefined): bigint {
  return toCents(value ?? 0);
}
