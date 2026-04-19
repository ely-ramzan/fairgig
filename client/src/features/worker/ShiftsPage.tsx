import { AppNav } from '../../components/shared/AppNav';
import { SerialHeader } from '../../components/shared/SerialHeader';
import { ShiftTable } from './components/ShiftTable';
import { useShifts } from '../../hooks/useShifts';
import { Link } from 'react-router-dom';

export function ShiftsPage() {
  const { data, isLoading } = useShifts({ page: 1, limit: 100 });
  const shifts = data?.items ?? [];

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

        {isLoading ? (
          <div className="flex items-center justify-center h-48 font-mono text-[10px] tracking-widest uppercase text-t4">
            Loading…
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <ShiftTable shifts={shifts} />
          </div>
        )}
      </main>
    </>
  );
}
