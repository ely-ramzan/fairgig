import { Link } from 'react-router-dom';
import { AppNav } from '../../components/shared/AppNav';

export function ForbiddenPage() {
  return (
    <>
      <AppNav />
      <main id="main" tabIndex={-1} className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <p className="font-mono text-[10px] tracking-widest uppercase text-rust">403 — Forbidden</p>
        <p className="font-sans text-sm text-t2 text-center max-w-md">You do not have access to this section.</p>
        <Link to="/dashboard" className="font-mono text-[10px] uppercase text-amber border border-amber px-4 py-2 rounded-sm">
          Go home
        </Link>
      </main>
    </>
  );
}
