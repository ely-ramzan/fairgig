import { useState }         from 'react';
import { AppNav }            from '../../components/shared/AppNav';
import { SerialHeader }      from '../../components/shared/SerialHeader';
import { SectionDivider }    from '../../components/shared/SectionDivider';
import { ErrorState }        from '../../components/shared/ErrorState';
import { GrievanceCard }     from './components/GrievanceCard';
import { GrievanceForm }     from './components/GrievanceForm';
import { useGrievances }     from '../../hooks/useGrievances';

const LIMIT = 20;

export function GrievanceBoardPage() {
  const [showForm, setShowForm] = useState(false);
  const [search,   setSearch]   = useState('');
  const [page,     setPage]     = useState(1);

  const { data, isLoading, isError, error, refetch } = useGrievances({ page, limit: LIMIT });
  const items      = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  const filtered = items.filter(
    (g) => !search || g.description.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <AppNav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <SerialHeader serial="04 —" label="Community Board" />
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="font-mono text-[10px] tracking-widest uppercase px-3 py-1.5 rounded border border-amber text-amber hover:bg-amber-bg transition-colors"
          >
            {showForm ? 'Cancel' : '+ New grievance'}
          </button>
        </div>

        {showForm && (
          <div className="bg-surface border border-border rounded-lg p-6 mb-6">
            <GrievanceForm onSuccess={() => setShowForm(false)} />
          </div>
        )}

        <div className="mb-4">
          <input
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search complaints…"
            className="w-full bg-surface border border-border rounded px-4 py-2.5 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber transition-colors"
          />
        </div>

        <SectionDivider />

        {isError ? (
          <ErrorState error={error} onRetry={refetch} />
        ) : isLoading ? (
          <div className="flex flex-col gap-3 animate-pulse">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-24 bg-surface border border-border rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 font-mono text-[10px] tracking-widest uppercase text-t4">
            {search ? 'No results for that search' : 'No grievances yet — be the first to post'}
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {filtered.map((g) => (
                <GrievanceCard key={g.id} grievance={g} />
              ))}
            </div>

            {totalPages > 1 && !search && (
              <div className="flex items-center justify-between mt-6 px-1">
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
