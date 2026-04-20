import { useEffect, useState } from 'react';
import { AppNav }            from '../../components/shared/AppNav';
import { SerialHeader }      from '../../components/shared/SerialHeader';
import { SectionDivider }    from '../../components/shared/SectionDivider';
import { ErrorState }        from '../../components/shared/ErrorState';
import { GrievanceCard }     from './components/GrievanceCard';
import { GrievanceForm }     from './components/GrievanceForm';
import { useGrievances }     from '../../hooks/useGrievances';
import { usePlatforms }      from '../../hooks/useWorkerData';

const LIMIT = 20;

const CATEGORIES = [
  'commission_change',
  'deactivation',
  'payment_delay',
  'unfair_rating',
  'safety',
  'other',
] as const;

const STATUSES: Array<'open' | 'escalated' | 'resolved'> = ['open', 'escalated', 'resolved'];

const CATEGORY_LABEL: Record<string, string> = {
  commission_change: 'Commission change',
  deactivation:      'Deactivation',
  payment_delay:     'Payment delay',
  unfair_rating:     'Unfair rating',
  safety:            'Safety',
  other:             'Other',
};

export function GrievanceBoardPage() {
  const [showForm, setShowForm] = useState(false);
  const [page, setPage] = useState(1);
  const [platformId, setPlatformId] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [tag, setTag] = useState('');
  const [debouncedTag, setDebouncedTag] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTag(tag.trim()), 350);
    return () => clearTimeout(t);
  }, [tag]);

  const { data: platforms = [] } = usePlatforms();

  const { data, isLoading, isError, error, refetch } = useGrievances({
    page,
    limit: LIMIT,
    platform_id: platformId || undefined,
    category: category || undefined,
    status: status || undefined,
    tag: debouncedTag || undefined,
  });
  const items      = data?.items ?? [];
  const totalPages = data?.total_pages ?? 1;

  const resetFilters = () => {
    setPlatformId('');
    setCategory('');
    setStatus('');
    setTag('');
    setDebouncedTag('');
    setPage(1);
  };

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
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="font-mono text-[9px] tracking-widest uppercase text-t4">Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              className="fg-select-compatible bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
            >
              <option value="">All</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</option>
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
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1 min-w-[120px] flex-1">
            <label className="font-mono text-[9px] tracking-widest uppercase text-t4">Tag</label>
            <input
              type="text"
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                setPage(1);
              }}
              placeholder="e.g. escalation"
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber"
            />
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="font-mono text-[10px] tracking-widest uppercase px-3 py-2 border border-border rounded text-t3 hover:text-t1"
          >
            Clear
          </button>
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
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 font-mono text-[10px] tracking-widest uppercase text-t4">
            No grievances match these filters
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              {items.map((g) => (
                <GrievanceCard key={g.id} grievance={g} />
              ))}
            </div>

            {totalPages > 1 && (
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
