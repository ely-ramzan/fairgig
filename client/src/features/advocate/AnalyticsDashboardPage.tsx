import { useState } from 'react';
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
import { useGrievanceClusters } from '../../hooks/useGrievances';
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
  const [vulnThreshold, setVulnThreshold] = useState(30);

  const { data: summary, isPending, isError, error, refetch } = useAnalyticsDashboard();
  const { data: commData }    = useCommissionTrends();
  const { data: incomeData }  = useIncomeDistribution();
  const { data: vulnData }    = useVulnerabilityFlags({ threshold: vulnThreshold });
  const { data: platformCmp } = usePlatformComparison({ months: 3 });
  const { data: clusters, isPending: clustersPending } = useGrievanceClusters({
    days: 30,
    min_cluster_size: 2,
  });

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

        <SectionDivider label="Grievance clusters" />
        <div className="bg-surface border border-border rounded-lg overflow-hidden mb-8">
          {clustersPending ? (
            <div className="h-32 animate-pulse bg-elevated m-4 rounded" />
          ) : clusters && clusters.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px] text-t2">
                <thead>
                  <tr className="border-b border-border text-t4">
                    <th className="px-4 py-2 font-normal">Platform</th>
                    <th className="px-4 py-2 font-normal">Category</th>
                    <th className="px-4 py-2 font-normal text-right">Complaints</th>
                    <th className="px-4 py-2 font-normal text-right">Escalated</th>
                    <th className="px-4 py-2 font-normal">Latest</th>
                  </tr>
                </thead>
                <tbody>
                  {clusters.map((c) => (
                    <tr key={`${c.platform_name}-${c.category}-${c.latest}`} className="border-b border-border/60">
                      <td className="px-4 py-2 text-t1">{c.platform_name}</td>
                      <td className="px-4 py-2">{c.category}</td>
                      <td className="px-4 py-2 text-right">{c.complaint_count}</td>
                      <td className="px-4 py-2 text-right">{c.escalated_count}</td>
                      <td className="px-4 py-2 text-t3">{c.latest.slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center font-mono text-[10px] text-t4">
              No clustered grievance patterns in the selected window
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
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label htmlFor="vuln-threshold" className="font-mono text-[10px] tracking-widest uppercase text-t3">
            Income drop threshold (%)
          </label>
          <input
            id="vuln-threshold"
            type="range"
            min={5}
            max={80}
            step={1}
            value={vulnThreshold}
            onChange={(e) => setVulnThreshold(Number(e.target.value))}
            className="w-40 accent-amber"
          />
          <span className="font-mono text-[10px] text-t2 tabular-nums">{vulnThreshold}%</span>
        </div>
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <VulnerabilityFlagsList flags={vulnData ?? []} />
        </div>
      </main>
    </>
  );
}
