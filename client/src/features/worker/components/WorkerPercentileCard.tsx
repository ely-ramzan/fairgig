import type { CityMedianComparisonRow } from '../../../types/api';
import { EmptyState } from '../../../components/shared/EmptyState';
import { formatPKR } from '../../../lib/formatting';

interface WorkerPercentileCardProps {
  rows: CityMedianComparisonRow[];
  /** Latest weekly net for the worker (same window as trends). */
  workerWeeklyNet?: number;
}

/** k-anonymity: when rows empty, zone comparison is withheld. */
export function WorkerPercentileCard({ rows, workerWeeklyNet }: WorkerPercentileCardProps) {
  if (!rows.length) {
    return (
      <EmptyState
        title="City comparison"
        description="Not enough anonymized data in your zone for a median comparison yet (k≥5 workers)."
      />
    );
  }
  const latest = rows[rows.length - 1];
  return (
    <div className="bg-surface border border-border rounded-sm p-4">
      <div className="font-mono text-[9px] tracking-widest uppercase text-t3 mb-2">Zone median (latest week)</div>
      <div className="font-serif text-xl text-t1">{latest.platform_name}</div>
      <div className="font-mono text-[10px] text-t2 mt-1">
        City median net {formatPKR(latest.city_median)} · P25–P75 {formatPKR(latest.p25_net)} –{' '}
        {formatPKR(latest.p75_net)}
      </div>
      {workerWeeklyNet != null && (
        <div className="font-sans text-xs text-t3 mt-2">Your week (net): {formatPKR(workerWeeklyNet)}</div>
      )}
    </div>
  );
}
