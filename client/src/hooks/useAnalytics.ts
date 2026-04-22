import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics';
import type { CommissionTrendPoint, VulnerabilityFlagRow } from '../types/api';

export type CommissionChartRow = { date: string; [platform: string]: string | number };

function pivotCommissionTrends(rows: CommissionTrendPoint[]) {
  const weekMap = new Map<string, CommissionChartRow>();
  const platformSet = new Set<string>();
  for (const r of rows) {
    const wk = String(r.week).slice(0, 10);
    platformSet.add(r.platform_name);
    if (!weekMap.has(wk)) weekMap.set(wk, { date: wk });
    const row = weekMap.get(wk)!;
    row[r.platform_name] = r.avg_commission_rate;
  }
  const series = Array.from(weekMap.values()).sort((a, b) =>
    String(a.date).localeCompare(String(b.date)),
  );
  return { series, platforms: Array.from(platformSet).sort() };
}

export function useAnalyticsDashboard() {
  return useQuery({
    queryKey: ['analytics', 'dashboard'],
    queryFn: () => analyticsApi.dashboardSummary().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}

export function useCommissionTrends(params?: { months?: number }) {
  return useQuery({
    queryKey: ['analytics', 'commission', params],
    queryFn: () => analyticsApi.commissionTrends(params).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    select: pivotCommissionTrends,
  });
}

export function useIncomeDistribution() {
  return useQuery({
    queryKey: ['analytics', 'income'],
    queryFn: () => analyticsApi.incomeDistribution().then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    select: (rows) =>
      rows.map((r) => ({
        zone_name: r.zone_name,
        median_net: r.p50_net,
        p25_net: r.p25_net,
        p75_net: r.p75_net,
        worker_count: r.worker_count,
      })),
  });
}

/**
 * `threshold` is accepted here as a percentage (0–100) to match the UI's
 * slider, but the backend validator is `threshold: float = Query(0.20, ge=0, le=1)`.
 * Converting here keeps callers ergonomic (30 for 30%) without trailing
 * decimals scattered across the app.
 */
export function useVulnerabilityFlags(params?: { threshold?: number }) {
  const wireParams =
    params?.threshold != null
      ? { threshold: Math.max(0, Math.min(1, params.threshold / 100)) }
      : undefined;
  return useQuery({
    queryKey: ['analytics', 'vulnerability', params],
    queryFn: () => analyticsApi.vulnerabilityFlags(wireParams).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    select: (rows: VulnerabilityFlagRow[]) =>
      rows.map((r) => ({
        worker_id:            r.worker_id,
        display_name:         r.display_name,
        city_zone:            r.city_zone,
        prev_month_net:       r.prev_month_net,
        curr_month_net:       r.curr_month_net,
        drop_pct:             r.mom_drop_pct,
        has_recent_anomalies: r.has_recent_anomalies ?? false,
      })),
  });
}

export function usePlatformComparison(params?: { months?: number }) {
  return useQuery({
    queryKey: ['analytics', 'platformComparison', params],
    queryFn: () => analyticsApi.platformComparison(params).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
  });
}
