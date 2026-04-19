import { Link } from 'react-router-dom';
import { AppNav } from '../../components/shared/AppNav';

export function NotFoundPage() {
  return (
    <>
      <AppNav />
      <main id="main" tabIndex={-1} className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
        <p className="font-mono text-[10px] tracking-widest uppercase text-t3">404 — Not found</p>
        <Link to="/" className="font-mono text-[10px] uppercase text-amber border border-amber px-4 py-2 rounded-sm">
          Home
        </Link>
      </main>
    </>
  );
}
