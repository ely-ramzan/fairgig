import { useState }        from 'react';
import { AppNav }          from '../../components/shared/AppNav';
import { KpiCard }          from '../../components/shared/KpiCard';
import { SerialHeader }     from '../../components/shared/SerialHeader';
import { AnomalyCallout }   from '../../components/shared/AnomalyCallout';
import { SectionDivider }   from '../../components/shared/SectionDivider';
import { ErrorState }       from '../../components/shared/ErrorState';
import { EarningsTrendChart } from './components/EarningsTrendChart';
import { CommissionBarChart } from './components/CommissionBarChart';
import { ShiftTable }       from './components/ShiftTable';
import { WorkerPercentileCard } from './components/WorkerPercentileCard';
import { useWorkerSummary, useWorkerTrends, useAnalyzeWorker } from '../../hooks/useWorkerData';
import { useShifts }        from '../../hooks/useShifts';
import { useAnomalies }     from '../../hooks/useAnomalies';
import { useCurrentUser }   from '../../stores/authStore';
import { useToast }         from '../../stores/uiStore';
import { fromWorkerEarningsTrend, fromCommissionTrend } from '../../lib/chartHelpers';
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
  const { toast } = useToast();
  const analyzeWorker = useAnalyzeWorker();
  const [analyzeDisabledUntil, setAnalyzeDisabledUntil] = useState<boolean>(false);

  const { data: summary, isPending: sumPending, isError: sumError, error: sumErr, refetch: refetchSum } =
    useWorkerSummary(wid);
  const { data: trends }     = useWorkerTrends(wid, { months: 3 });
  const { data: recentPage } = useShifts({ page: 1, limit: 10 });
  const { data: anomalies }  = useAnomalies(wid);

  const [showAllAnomalies, setShowAllAnomalies] = useState(false);

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
  const commissionData = trends ? fromCommissionTrend(trends.commission_trend) : [];
  const lastWeekNet   = trends?.earnings_trend?.at(-1)?.net_income;
  const allAnomalies  = anomalies ?? [];
  const highAnomalies = allAnomalies.filter((a) => a.severity === 'high');
  const topHighIds    = new Set(highAnomalies.slice(0, 3).map((a) => a.id));
  const remainingAnomalies = allAnomalies.filter((a) => !topHighIds.has(a.id));

  return (
    <>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <SerialHeader serial="01 —" label="Dashboard" />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <span className="font-mono text-[10px] tracking-widest uppercase text-t3">Anomaly analysis</span>
          <button
            type="button"
            disabled={analyzeWorker.isPending || !wid || analyzeDisabledUntil}
            onClick={() => {
              analyzeWorker.mutate(undefined, {
                onSuccess: (data) => {
                  const n = (data as { anomalies_cached?: number }).anomalies_cached ?? 0;
                  toast(`Analysis complete — ${n} cached anomalies`, 'success');
                  setAnalyzeDisabledUntil(true);
                  setTimeout(() => setAnalyzeDisabledUntil(false), 30_000);
                },
                onError: () => toast('Could not refresh anomaly analysis', 'error'),
              });
            }}
            className="font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded border border-amber text-amber hover:bg-amber-bg disabled:opacity-40 transition-colors"
          >
            {analyzeWorker.isPending ? 'Analyzing…' : 'Refresh anomaly analysis'}
          </button>
        </div>

        {(highAnomalies.length > 0 || remainingAnomalies.length > 0) && (
          <div className="flex flex-col gap-2 mb-6">
            {highAnomalies.slice(0, 3).map((a) => (
              <AnomalyCallout
                key={a.id}
                title={a.anomaly_type.replace(/_/g, ' ')}
                message={a.explanation}
                severity={a.severity}
              />
            ))}

            {remainingAnomalies.length > 0 && (
              <button
                type="button"
                onClick={() => setShowAllAnomalies((v) => !v)}
                className="self-start font-mono text-[10px] tracking-widest uppercase text-amber hover:text-amber-bright px-1 py-1 transition-colors"
              >
                {showAllAnomalies
                  ? '− Hide additional anomalies'
                  : `+ View ${remainingAnomalies.length} more ${remainingAnomalies.length === 1 ? 'anomaly' : 'anomalies'}`}
              </button>
            )}

            {showAllAnomalies && remainingAnomalies.length > 0 && (
              <div className="bg-surface border border-border rounded-lg divide-y divide-border">
                {remainingAnomalies.map((a) => (
                  <div key={a.id} className="px-4 py-3 flex items-start gap-3">
                    <span
                      className={
                        'font-mono text-[9px] tracking-widest uppercase px-2 py-0.5 rounded border shrink-0 ' +
                        (a.severity === 'high'
                          ? 'border-rust text-rust'
                          : a.severity === 'medium'
                            ? 'border-amber text-amber'
                            : 'border-border text-t3')
                      }
                    >
                      {a.severity}
                    </span>
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="font-mono text-[10px] tracking-widest uppercase text-t2">
                        {a.anomaly_type.replace(/_/g, ' ')}
                      </span>
                      <span className="font-sans text-sm text-t1">{a.explanation}</span>
                    </div>
                  </div>
                ))}
              </div>
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

        {(summary?.platform_breakdown?.length ?? 0) > 0 && (
          <div className="mb-8 bg-surface border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-border font-mono text-[9px] tracking-widest uppercase text-t4">
              By platform
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[10px] text-t2">
                <thead>
                  <tr className="border-b border-border text-t4">
                    <th className="px-4 py-2 font-normal">Platform</th>
                    <th className="px-4 py-2 font-normal text-right">Shifts</th>
                    <th className="px-4 py-2 font-normal text-right">Net</th>
                    <th className="px-4 py-2 font-normal text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {summary!.platform_breakdown.map((row) => (
                    <tr key={row.platform} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2 text-t1">{row.platform}</td>
                      <td className="px-4 py-2 text-right">{row.shifts}</td>
                      <td className="px-4 py-2 text-right">{formatPKR(row.net, true)}</td>
                      <td className="px-4 py-2 text-right">{formatPercent(row.commission_pct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

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

        <SectionDivider label="Commission trend" />
        <div className="bg-surface border border-border rounded-lg p-4 mb-8">
          {commissionData.length > 0 ? (
            <CommissionBarChart data={commissionData} />
          ) : (
            <div className="h-28 flex items-center justify-center font-mono text-[10px] text-t4">
              No commission data yet
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
