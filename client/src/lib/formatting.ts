// PKR formatting, date formatting utilities.

const PKR_FORMATTER = new Intl.NumberFormat('en-PK', {
  style:                 'currency',
  currency:              'PKR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const PKR_FORMATTER_DECIMAL = new Intl.NumberFormat('en-PK', {
  style:                 'currency',
  currency:              'PKR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPKR(value: number, decimals = false): string {
  return (decimals ? PKR_FORMATTER_DECIMAL : PKR_FORMATTER).format(value);
}

export function formatCompactPKR(value: number): string {
  if (value >= 100_000) return `PKR ${(value / 100_000).toFixed(1)}L`;
  if (value >= 1_000)   return `PKR ${(value / 1_000).toFixed(1)}K`;
  return formatPKR(value);
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-PK', {
  year: 'numeric', month: 'short', day: 'numeric',
});

const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-PK', {
  month: 'short', day: 'numeric',
});

export function formatDate(isoString: string): string {
  return DATE_FORMATTER.format(new Date(isoString));
}

export function formatShortDate(isoString: string): string {
  return SHORT_DATE_FORMATTER.format(new Date(isoString));
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatHours(hours: number): string {
  return `${hours.toFixed(1)}h`;
}
