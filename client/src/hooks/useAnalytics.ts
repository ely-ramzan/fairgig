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

export function useVulnerabilityFlags(params?: { threshold?: number }) {
  return useQuery({
    queryKey: ['analytics', 'vulnerability', params],
    queryFn: () => analyticsApi.vulnerabilityFlags(params).then((r) => r.data),
    staleTime: 1000 * 60 * 5,
    select: (rows: VulnerabilityFlagRow[]) =>
      rows.map((r) => ({
        worker_id:      r.worker_id,
        display_name:   r.display_name,
        prev_month_net: r.prev_month_net,
        curr_month_net: r.curr_month_net,
        drop_pct:       r.mom_drop_pct,
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
