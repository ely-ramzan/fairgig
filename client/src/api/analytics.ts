import { analyticsClient } from './client';
import type {
  AnalyticsDashboardSummary,
  CommissionTrendPoint,
  IncomeDistributionPoint,
  PlatformComparisonRow,
  VulnerabilityFlagRow,
} from '../types/api';

export const analyticsApi = {
  dashboardSummary: (signal?: AbortSignal) =>
    analyticsClient.get<AnalyticsDashboardSummary>('/api/analytics/dashboard-summary', { signal }),

  commissionTrends: (params?: { months?: number }, signal?: AbortSignal) =>
    analyticsClient.get<CommissionTrendPoint[]>('/api/analytics/commission-trends', { params, signal }),

  incomeDistribution: (signal?: AbortSignal) =>
    analyticsClient.get<IncomeDistributionPoint[]>('/api/analytics/income-distribution', { signal }),

  vulnerabilityFlags: (params?: { threshold?: number }, signal?: AbortSignal) =>
    analyticsClient.get<VulnerabilityFlagRow[]>('/api/analytics/vulnerability-flags', { params, signal }),

  platformComparison: (params?: { months?: number }, signal?: AbortSignal) =>
    analyticsClient.get<PlatformComparisonRow[]>('/api/analytics/platform-comparison', { params, signal }),

  refreshViews: () =>
    analyticsClient.post<{ refreshed: string[]; refreshed_at: string }>('/api/analytics/refresh-views'),
};
