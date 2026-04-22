import type { Shift } from '../types/api';
import type { EarningsTrendPoint, CommissionPoint } from '../types/charts';
import type { EarningsTrendRow, CommissionTrendRow } from '../types/api';
import { formatShortDate } from './formatting';

// Transform raw shifts array into Recharts-compatible weekly earnings series.
/** Weekly aggregates from GET /earnings/worker/:id/trends */
export function fromWorkerEarningsTrend(rows: EarningsTrendRow[]): EarningsTrendPoint[] {
  // Weekly trend rows only expose net_income + avg_hourly — no separate gross series.
  return rows.map((r) => ({
    date: formatShortDate(String(r.week)),
    net_received: Math.round(r.net_income),
  }));
}

/** Commission rate trend from GET /earnings/worker/:id/trends */
export function fromCommissionTrend(rows: CommissionTrendRow[]): CommissionPoint[] {
  return rows.map((r) => ({
    date: formatShortDate(String(r.week)),
    platform: r.platform_name,
    commission_rate: Math.round(r.commission_rate * 10) / 10,
  }));
}

export function toEarningsTrend(shifts: Shift[]): EarningsTrendPoint[] {
  const byDate = new Map<string, { net: number; gross: number }>();

  for (const shift of shifts) {
    const existing = byDate.get(shift.shift_date);
    if (existing) {
      existing.net   += shift.net_received;
      existing.gross += shift.gross_earned;
    } else {
      byDate.set(shift.shift_date, { net: shift.net_received, gross: shift.gross_earned });
    }
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date:         formatShortDate(date),
      net_received: Math.round(v.net),
      gross_earned: Math.round(v.gross),
    }));
}

// Transform shifts into commission rate series per platform.
export function toCommissionSeries(shifts: Shift[]): CommissionPoint[] {
  return shifts
    .filter((s) => s.gross_earned > 0)
    .map((s) => ({
      date:            formatShortDate(s.shift_date),
      platform:        s.platform_name ?? s.platform_id,
      commission_rate: parseFloat(((s.platform_deductions / s.gross_earned) * 100).toFixed(1)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
