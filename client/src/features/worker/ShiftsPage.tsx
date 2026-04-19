import { useState } from 'react';
import { Link }     from 'react-router-dom';
import { AppNav }       from '../../components/shared/AppNav';
import { SerialHeader } from '../../components/shared/SerialHeader';
import { ErrorState }   from '../../components/shared/ErrorState';
import { ShiftTable }   from './components/ShiftTable';
import { useShifts }    from '../../hooks/useShifts';
import { usePlatforms } from '../../hooks/useWorkerData';

const LIMIT = 20;

function ShiftTableSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden animate-pulse">
      {Array.from({ length: LIMIT }).map((_, i) => (
        <div key={i} className="border-b border-border px-4 py-3 flex gap-4">
          <div className="h-3 w-20 bg-elevated rounded" />
          <div className="h-3 w-16 bg-elevated rounded" />
          <div className="h-3 w-12 bg-elevated rounded ml-auto" />
          <div className="h-3 w-16 bg-elevated rounded" />
          <div className="h-3 w-10 bg-elevated rounded" />
          <div className="h-3 w-14 bg-elevated rounded" />
        </div>
      ))}
    </div>
  );
}

export function ShiftsPage() {
  const [page, setPage] = useState(1);
  const [platformId, setPlatformId] = useState('');
  const [status, setStatus] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const { data: platforms = [] } = usePlatforms();

  const { data, isLoading, isError, error, refetch } = useShifts({
    page,
    limit: LIMIT,
    platform_id: platformId || undefined,
    status: status || undefined,
    date_from: dateFrom || undefined,
    date_to: dateTo || undefined,
  });
  const shifts     = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  return (
    <>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
          <SerialHeader serial="02 —" label="Shift Log" />
          <div className="flex items-center gap-2">
            <Link
              to="/shifts/import"
              className="font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded border border-border text-t2 hover:text-t1 hover:border-t2 transition-colors"
            >
              ⇪ Import CSV / Excel
            </Link>
            <Link
              to="/shifts/new"
              className="font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded border border-amber text-amber hover:bg-amber-bg transition-colors"
            >
              + Log Shift
            </Link>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="font-mono text-[9px] tracking-widest uppercase text-t4">Platform</label>
            <select
              value={platformId}
              onChange={(e) => {
                setPlatformId(e.target.value);
                setPage(1);
              }}
              className="fg-select-compatible bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
            >
              <option value="">All</option>
              {platforms.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="font-mono text-[9px] tracking-widest uppercase text-t4">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="fg-select-compatible bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="disputed">Disputed</option>
              <option value="unverifiable">Unverifiable</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[9px] tracking-widest uppercase text-t4">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[9px] tracking-widest uppercase text-t4">To</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
            />
          </div>
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <ShiftTableSkeleton />
        ) : shifts.length === 0 && page === 1 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 border border-border rounded-lg bg-surface">
            <p className="font-mono text-[10px] tracking-widest uppercase text-t4">No shifts logged yet</p>
            <div className="flex flex-wrap items-center gap-2 justify-center">
              <Link to="/shifts/new" className="font-mono text-[10px] tracking-widest uppercase text-amber border border-amber px-3 py-1.5 rounded hover:bg-amber-bg transition-colors">
                Log your first shift →
              </Link>
              <Link to="/shifts/import" className="font-mono text-[10px] tracking-widest uppercase text-t2 border border-border px-3 py-1.5 rounded hover:text-t1 hover:border-t2 transition-colors">
                or import CSV / Excel
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="bg-surface border border-border rounded-lg overflow-hidden">
              <ShiftTable shifts={shifts} />
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 px-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm text-t2 hover:text-t1 disabled:opacity-30 transition-colors"
                >
                  ← Previous
                </button>
                <span className="font-mono text-[10px] text-t3">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="font-mono text-[10px] uppercase tracking-widest px-3 py-1.5 border border-border rounded-sm text-t2 hover:text-t1 disabled:opacity-30 transition-colors"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
