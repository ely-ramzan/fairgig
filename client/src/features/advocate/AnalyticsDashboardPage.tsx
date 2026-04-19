import { AppNav }               from '../../components/shared/AppNav';
import { KpiCard }               from '../../components/shared/KpiCard';
import { SerialHeader }          from '../../components/shared/SerialHeader';
import { SectionDivider }        from '../../components/shared/SectionDivider';
import { ErrorState }            from '../../components/shared/ErrorState';
import { CommissionTrendsChart } from './components/CommissionTrendsChart';
import { ZoneDistributionChart } from './components/ZoneDistributionChart';
import { VulnerabilityFlagsList } from './components/VulnerabilityFlagsList';
import { PlatformComparisonChart } from './components/PlatformComparisonChart';
import {
  useAnalyticsDashboard,
  useCommissionTrends,
  useIncomeDistribution,
  useVulnerabilityFlags,
  usePlatformComparison,
} from '../../hooks/useAnalytics';
import { formatPercent } from '../../lib/formatting';

function AnalyticsSkeleton() {
  return (
    <>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-4 w-40 bg-surface rounded mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface border border-border rounded-lg" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-56 bg-surface border border-border rounded-lg mb-8" />
        ))}
      </main>
    </>
  );
}

export function AnalyticsDashboardPage() {
  const { data: summary, isPending, isError, error, refetch } = useAnalyticsDashboard();
  const { data: commData }    = useCommissionTrends();
  const { data: incomeData }  = useIncomeDistribution();
  const { data: vulnData }    = useVulnerabilityFlags();
  const { data: platformCmp } = usePlatformComparison({ months: 3 });

  if (isPending) return <AnalyticsSkeleton />;

  if (isError) {
    return (
      <>
        <AppNav />
        <div className="max-w-7xl mx-auto px-4 py-16">
          <ErrorState error={error} onRetry={refetch} title="Could not load analytics" />
        </div>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <SerialHeader serial="05 —" label="Advocate Analytics" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <KpiCard label="Active Workers"     value={summary?.total_active_workers ?? '—'} />
          <KpiCard
            label="Avg Commission"
            value={summary?.avg_commission_rate != null ? formatPercent(summary.avg_commission_rate) : '—'}
            accent={!!summary && summary.avg_commission_rate > 25}
          />
          <KpiCard label="Open Grievances"    value={summary?.open_grievances ?? '—'} />
          <KpiCard label="Vulnerability Flags" value={summary?.vulnerable_workers_count ?? '—'} accent />
        </div>

        <SectionDivider label="Commission trends" />
        <div className="bg-surface border border-border rounded-lg p-4 mb-8">
          {commData && commData.series.length > 0 ? (
            <CommissionTrendsChart data={commData.series} platforms={commData.platforms} />
          ) : (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-t4">
              No commission data — seed data required
            </div>
          )}
        </div>

        <SectionDivider label="Platform comparison" />
        <div className="bg-surface border border-border rounded-lg p-4 mb-8">
          {platformCmp && platformCmp.length > 0 ? (
            <PlatformComparisonChart data={platformCmp} />
          ) : (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-t4">
              No platform data yet
            </div>
          )}
        </div>

        <SectionDivider label="Zone income distribution" />
        <div className="bg-surface border border-border rounded-lg p-4 mb-8">
          {incomeData && incomeData.length > 0 ? (
            <ZoneDistributionChart data={incomeData} />
          ) : (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-t4">
              Insufficient data — zones need ≥5 workers each
            </div>
          )}
        </div>

        <SectionDivider label="Vulnerability flags" />
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <VulnerabilityFlagsList flags={vulnData ?? []} />
        </div>
      </main>
    </>
  );
}
