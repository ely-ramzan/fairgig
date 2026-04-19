import { AppNav }          from '../../components/shared/AppNav';
import { KpiCard }          from '../../components/shared/KpiCard';
import { SerialHeader }     from '../../components/shared/SerialHeader';
import { AnomalyCallout }   from '../../components/shared/AnomalyCallout';
import { SectionDivider }   from '../../components/shared/SectionDivider';
import { ErrorState }       from '../../components/shared/ErrorState';
import { EarningsTrendChart } from './components/EarningsTrendChart';
import { ShiftTable }       from './components/ShiftTable';
import { WorkerPercentileCard } from './components/WorkerPercentileCard';
import { useWorkerSummary, useWorkerTrends } from '../../hooks/useWorkerData';
import { useShifts }        from '../../hooks/useShifts';
import { useAnomalies }     from '../../hooks/useAnomalies';
import { useCurrentUser }   from '../../stores/authStore';
import { fromWorkerEarningsTrend } from '../../lib/chartHelpers';
import { formatPKR, formatHours, formatPercent } from '../../lib/formatting';

function DashboardSkeleton() {
  return (
    <>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-8 animate-pulse">
        <div className="h-4 w-32 bg-surface rounded mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 bg-surface border border-border rounded-lg" />
          ))}
        </div>
        <div className="h-32 bg-surface border border-border rounded-lg mb-8" />
        <div className="h-56 bg-surface border border-border rounded-lg mb-8" />
        <div className="h-48 bg-surface border border-border rounded-lg" />
      </main>
    </>
  );
}

export function DashboardPage() {
  const user = useCurrentUser();
  const wid  = user?.id ?? '';

  const { data: summary, isPending: sumPending, isError: sumError, error: sumErr, refetch: refetchSum } =
    useWorkerSummary(wid);
  const { data: trends }     = useWorkerTrends(wid, { months: 3 });
  const { data: recentPage } = useShifts({ page: 1, limit: 10 });
  const { data: anomalies }  = useAnomalies(wid);

  if (sumPending) return <DashboardSkeleton />;

  if (sumError) {
    return (
      <>
        <AppNav />
        <div className="max-w-7xl mx-auto px-4 py-16">
          <ErrorState error={sumErr} onRetry={refetchSum} title="Could not load dashboard" />
        </div>
      </>
    );
  }

  const recentShifts  = recentPage?.items ?? [];
  const trendData     = trends ? fromWorkerEarningsTrend(trends.earnings_trend) : [];
  const lastWeekNet   = trends?.earnings_trend?.at(-1)?.net_income;
  const highAnomalies = (anomalies ?? []).filter((a) => a.severity === 'high');

  return (
    <>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <SerialHeader serial="01 —" label="Dashboard" />

        {highAnomalies.length > 0 && (
          <div className="flex flex-col gap-2 mb-6">
            {highAnomalies.slice(0, 3).map((a) => (
              <AnomalyCallout
                key={a.id}
                title={a.anomaly_type.replace(/_/g, ' ')}
                message={a.explanation}
                severity={a.severity}
              />
            ))}
            {highAnomalies.length > 3 && (
              <p className="font-mono text-[10px] text-t3 pl-1">
                +{highAnomalies.length - 3} more anomalies detected
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <KpiCard label="Net Earned"     value={formatPKR(summary?.total_net ?? 0)} />
          <KpiCard label="Gross Earned"   value={formatPKR(summary?.total_gross ?? 0)} />
          <KpiCard label="Hours Worked"   value={formatHours(summary?.total_hours ?? 0)} />
          <KpiCard
            label="Avg Commission"
            value={formatPercent(summary?.avg_commission_rate ?? 0)}
            accent={(summary?.avg_commission_rate ?? 0) > 25}
          />
        </div>

        <div className="mb-8">
          <WorkerPercentileCard
            rows={trends?.city_median_comparison ?? []}
            workerWeeklyNet={lastWeekNet}
          />
        </div>

        <SectionDivider label="Earnings trend" />
        <div className="bg-surface border border-border rounded-lg p-4 mb-8">
          {trendData.length > 0 ? (
            <EarningsTrendChart data={trendData} />
          ) : (
            <div className="h-40 flex items-center justify-center font-mono text-[10px] text-t4">
              No trend data yet — log more shifts to see your chart
            </div>
          )}
        </div>

        <SectionDivider label="Recent shifts" />
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <ShiftTable shifts={recentShifts} />
        </div>
      </main>
    </>
  );
}
