import { useState } from 'react';
import { AppNav } from '../../components/shared/AppNav';
import { SerialHeader } from '../../components/shared/SerialHeader';
import { SectionDivider } from '../../components/shared/SectionDivider';
import { GrievanceCard } from './components/GrievanceCard';
import { GrievanceForm } from './components/GrievanceForm';
import { useGrievances } from '../../hooks/useGrievances';

export function GrievanceBoardPage() {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');

  const { data, isLoading } = useGrievances({ page: 1, limit: 100 });
  const items = data?.items ?? [];

  const filtered = items.filter((g) => !search || g.description.toLowerCase().includes(search.toLowerCase()));

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
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search complaints…"
            className="w-full bg-surface border border-border rounded px-4 py-2.5 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber transition-colors"
          />
        </div>

        <SectionDivider />

        {isLoading ? (
          <div className="flex items-center justify-center h-48 font-mono text-[10px] tracking-widest uppercase text-t4">
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 font-mono text-[10px] tracking-widest uppercase text-t4">
            {search ? 'No results' : 'No grievances yet'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((g) => (
              <GrievanceCard key={g.id} grievance={g} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
