import { useState } from 'react';
import { Link }     from 'react-router-dom';
import { AppNav }       from '../../components/shared/AppNav';
import { SerialHeader } from '../../components/shared/SerialHeader';
import { ErrorState }   from '../../components/shared/ErrorState';
import { ShiftTable }   from './components/ShiftTable';
import { useShifts }    from '../../hooks/useShifts';

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
  const { data, isLoading, isError, error, refetch } = useShifts({ page, limit: LIMIT });
  const shifts     = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  return (
    <>
      <AppNav />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <SerialHeader serial="02 —" label="Shift Log" />
          <Link
            to="/shifts/new"
            className="font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded border border-amber text-amber hover:bg-amber-bg transition-colors"
          >
            + Log Shift
          </Link>
        </div>

        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <ShiftTableSkeleton />
        ) : shifts.length === 0 && page === 1 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 border border-border rounded-lg bg-surface">
            <p className="font-mono text-[10px] tracking-widest uppercase text-t4">No shifts logged yet</p>
            <Link to="/shifts/new" className="font-mono text-[10px] tracking-widest uppercase text-amber border border-amber px-3 py-1.5 rounded hover:bg-amber-bg transition-colors">
              Log your first shift →
            </Link>
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
