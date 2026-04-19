import { Link } from 'react-router-dom';
import { SKIP_AUTH_FOR_TESTING } from '../../config/testAuth';

const LINKS: { to: string; label: string; note: string }[] = [
  { to: '/landing',      label: 'Landing (Awwwards hero)', note: 'public' },
  { to: '/login',        label: 'Login',              note: 'public' },
  { to: '/register',     label: 'Register',           note: 'public' },
  { to: '/dashboard',    label: 'Worker dashboard', note: 'worker' },
  { to: '/shifts',       label: 'Shift log',        note: 'worker' },
  { to: '/shifts/new',   label: 'Log shift (form)', note: 'worker' },
  { to: '/shifts/import', label: 'CSV import',      note: 'worker' },
  { to: '/certificate',  label: 'Certificate',      note: 'worker' },
  { to: '/community',    label: 'Community / grievances', note: 'worker + advocate' },
  { to: '/verify',       label: 'Verifier queue',   note: 'verifier' },
  { to: '/analytics',    label: 'Advocate analytics', note: 'advocate' },
  { to: '/unauthorized', label: 'Unauthorized page', note: 'public' },
];

/**
 * Public UI map — open this when the backend is off.
 * With SKIP_AUTH_FOR_TESTING, all protected routes render without login.
 */
export function DevHubPage() {
  return (
    <main className="min-h-screen bg-bg px-4 py-10 max-w-2xl mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[10px] tracking-[0.25em] uppercase text-amber mb-2">
          FairGig · UI preview
        </div>
        <h1 className="font-serif text-2xl text-t1">All screens</h1>
        <p className="font-sans text-sm text-t2 mt-2">
          {SKIP_AUTH_FOR_TESTING
            ? 'Auth bypass is ON — click any route below. API calls will fail silently; layouts still render.'
            : 'Turn on SKIP_AUTH_FOR_TESTING in src/config/testAuth.ts to browse without logging in.'}
        </p>
      </div>

      <ul className="flex flex-col gap-2 list-none m-0 p-0">
        {LINKS.map(({ to, label, note }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex items-center justify-between gap-4 bg-surface border border-border rounded-lg px-4 py-3 hover:border-amber transition-colors group"
            >
              <span className="font-sans text-sm text-t1 group-hover:text-amber">{label}</span>
              <span className="font-mono text-[9px] tracking-wide text-t4 shrink-0">{note}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="font-mono text-[10px] text-t4 mt-8 tracking-wide">
        Tip: set your app entry to <code className="text-amber">/dev</code> or bookmark this page while the API is down.
      </p>
    </main>
  );
}
