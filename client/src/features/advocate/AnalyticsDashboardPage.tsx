import { useState, useEffect } from 'react';
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
  useRefreshViews,
} from '../../hooks/useAnalytics';
import { useGrievanceClusters } from '../../hooks/useGrievances';
import { formatPercent } from '../../lib/formatting';

type RefreshMutation = ReturnType<typeof useRefreshViews>;

function RefreshButton({ refreshViews }: { refreshViews: RefreshMutation }) {
  return (
    <button
      type="button"
      disabled={refreshViews.isPending}
      onClick={() => refreshViews.mutate()}
      className="font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 border border-border rounded text-t3 hover:text-t1 hover:border-t2 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {refreshViews.isPending ? 'refreshing…' : 'refresh now'}
    </button>
  );
}

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
  // Debounce the slider so we only fire a new API request 400 ms after
  // the user stops dragging rather than on every pixel of movement.
  const [debouncedThreshold, setDebouncedThreshold] = useState(30);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedThreshold(vulnThreshold), 400);
    return () => clearTimeout(t);
  }, [vulnThreshold]);

  const { data: summary, isPending, isError, error, refetch } = useAnalyticsDashboard();
  const { data: commData,    isError: commError    } = useCommissionTrends();
  const { data: incomeData,  isError: incomeError  } = useIncomeDistribution();
  const { data: vulnData, isError: vulnError, isFetching: vulnFetching } = useVulnerabilityFlags({ threshold: debouncedThreshold });
  const { data: platformCmp, isError: platformError } = usePlatformComparison({ months: 3 });
  const { data: clusters, isPending: clustersPending, isError: clustersError } = useGrievanceClusters({
    days: 30,
    min_cluster_size: 2,
  });
  const refreshViews = useRefreshViews();

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
          <KpiCard label="Vulnerability Flags" value={summary?.vulnerable_workers_count ?? '—'} subtext="at 20% drop threshold" accent />
        </div>
        {(() => {
          const asOf = summary?.views_as_of;
          if (!asOf) return null;
          const date   = new Date(asOf);
          const now    = new Date();
          const ageMs  = now.getTime() - date.getTime();
          const ageDays = ageMs / (1000 * 60 * 60 * 24);
          // neutral up to 7 days, amber 7–14 days, red beyond 14 days.
          // NOTE: full class names must be literal strings so Tailwind's
          // static scanner includes them in the bundle.
          const label = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
          if (ageDays > 14) {
            return (
              <div className="flex items-center gap-3 mb-8 -mt-5">
                <p className="font-mono text-[9px] tracking-widest uppercase text-rust">
                  View data as of {label} · refresh job may be overdue
                </p>
                <RefreshButton refreshViews={refreshViews} />
              </div>
            );
          }
          if (ageDays > 7) {
            return (
              <div className="flex items-center gap-3 mb-8 -mt-5">
                <p className="font-mono text-[9px] tracking-widest uppercase text-amber">
                  View data as of {label} · refresh job may be overdue
                </p>
                <RefreshButton refreshViews={refreshViews} />
              </div>
            );
          }
          return (
            <div className="flex items-center gap-3 mb-8 -mt-5">
              <p className="font-mono text-[9px] tracking-widest uppercase text-t4">
                View data as of {label} · up to date
              </p>
              <RefreshButton refreshViews={refreshViews} />
            </div>
          );
        })()}

        <SectionDivider label="Commission trends" />
        <div className="bg-surface border border-border rounded-lg p-4 mb-8">
          {commError ? (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-rust">Failed to load commission data</div>
          ) : commData && commData.series.length > 0 ? (
            <CommissionTrendsChart data={commData.series} platforms={commData.platforms} />
          ) : (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-t4">
              No commission data — seed data required
            </div>
          )}
        </div>

        <SectionDivider label="Platform comparison" />
        <div className="bg-surface border border-border rounded-lg p-4 mb-8">
          {platformError ? (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-rust">Failed to load platform data</div>
          ) : platformCmp && platformCmp.length > 0 ? (
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
          ) : clustersError ? (
            <div className="p-8 text-center font-mono text-[10px] text-rust">Failed to load grievance clusters</div>
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
                    <tr key={`${c.platform_name}·${c.category}·${String(c.latest).slice(0, 10)}`} className="border-b border-border/60">
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
          {incomeError ? (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-rust">Failed to load income data</div>
          ) : incomeData && incomeData.length > 0 ? (
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
          {vulnError ? (
            <div className="p-8 text-center font-mono text-[10px] text-rust">Failed to load vulnerability flags</div>
          ) : vulnFetching ? (
            <ul className="flex flex-col divide-y divide-border list-none m-0 p-0 animate-pulse">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="py-3 px-4 flex items-center justify-between gap-4">
                  <div className="flex flex-col gap-1.5">
                    <div className="h-3 w-32 bg-elevated rounded" />
                    <div className="h-2 w-44 bg-elevated rounded" />
                  </div>
                  <div className="h-3 w-16 bg-elevated rounded" />
                </li>
              ))}
            </ul>
          ) : (
            <VulnerabilityFlagsList flags={vulnData ?? []} />
          )}
        </div>
      </main>
    </>
  );
}
