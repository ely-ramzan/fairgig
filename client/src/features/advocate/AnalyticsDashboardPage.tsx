import { AppNav }                  from '../../components/shared/AppNav';
import { KpiCard }                  from '../../components/shared/KpiCard';
import { SerialHeader }             from '../../components/shared/SerialHeader';
import { SectionDivider }           from '../../components/shared/SectionDivider';
import { CommissionTrendsChart }    from './components/CommissionTrendsChart';
import { ZoneDistributionChart }    from './components/ZoneDistributionChart';
import { VulnerabilityFlagsList }   from './components/VulnerabilityFlagsList';
import {
  useAnalyticsDashboard,
  useCommissionTrends,
  useIncomeDistribution,
  useVulnerabilityFlags,
  usePlatformComparison,
} from '../../hooks/useAnalytics';
import { PlatformComparisonChart } from './components/PlatformComparisonChart';
import { formatPercent } from '../../lib/formatting';

export function AnalyticsDashboardPage() {
  const { data: summary, isPending } = useAnalyticsDashboard();
  const { data: commData }   = useCommissionTrends();
  const { data: incomeData } = useIncomeDistribution();
  const { data: vulnData }   = useVulnerabilityFlags();
  const { data: platformCmp } = usePlatformComparison({ months: 3 });

  if (isPending) {
    return (
      <>
        <AppNav />
        <div className="flex items-center justify-center h-64 font-mono text-[10px] tracking-widest uppercase text-t4">
          Loading…
        </div>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <SerialHeader serial="05 —" label="Advocate Analytics" />

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <KpiCard label="Active Workers" value={summary?.total_active_workers ?? '—'} />
          <KpiCard
            label="Avg Commission"
            value={summary?.avg_commission_rate != null ? formatPercent(summary.avg_commission_rate) : '—'}
            accent={!!summary && summary.avg_commission_rate > 25}
          />
          <KpiCard label="Open Grievances" value={summary?.open_grievances ?? '—'} />
          <KpiCard label="Vulnerability Flags" value={summary?.vulnerable_workers_count ?? '—'} accent />
        </div>

        {/* Commission trends */}
        <SectionDivider label="Commission trends" />
        <div className="bg-surface border border-border rounded-lg p-4 mb-8">
          {commData ? (
            <CommissionTrendsChart
              data={commData.series ?? []}
              platforms={commData.platforms ?? []}
            />
          ) : (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-t4">No data</div>
          )}
        </div>

        <SectionDivider label="Platform comparison" />
        <div className="bg-surface border border-border rounded-lg p-4 mb-8">
          {platformCmp && platformCmp.length > 0 ? (
            <PlatformComparisonChart data={platformCmp} />
          ) : (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-t4">No data</div>
          )}
        </div>

        {/* Zone distribution */}
        <SectionDivider label="Zone income distribution" />
        <div className="bg-surface border border-border rounded-lg p-4 mb-8">
          {incomeData ? (
            <ZoneDistributionChart data={incomeData ?? []} />
          ) : (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-t4">No data</div>
          )}
        </div>

        {/* Vulnerability flags */}
        <SectionDivider label="Vulnerability flags" />
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <VulnerabilityFlagsList flags={vulnData ?? []} />
        </div>
      </main>
    </>
  );
}
