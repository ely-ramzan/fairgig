import { Link }      from 'react-router-dom';
import { LoginForm } from './components/LoginForm';
import { SKIP_AUTH_FOR_TESTING } from '../../config/testAuth';

export function LoginPage() {
  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      {SKIP_AUTH_FOR_TESTING && (
        <div className="mb-6 w-full max-w-sm rounded-lg border border-amber/30 bg-amber-bg px-4 py-3 text-center">
          <p className="font-sans text-sm text-t1 mb-2">
            Backend off? Browse every screen without logging in.
          </p>
          <Link
            to="/dev"
            className="inline-block font-mono text-[11px] tracking-widest uppercase text-amber hover:underline"
          >
            Open screen map →
          </Link>
        </div>
      )}
      <div className="mb-8 text-center">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-amber mb-2">
          FAIR<span className="text-t2">GIG</span>
        </div>
        <h1 className="font-serif text-3xl text-t1">Welcome back</h1>
        <p className="font-sans text-sm text-t2 mt-1">Sign in to your account</p>
      </div>

      <div className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm">
        <LoginForm />
      </div>

      <p className="font-sans text-sm text-t3 mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-amber hover:underline">
          Register
        </Link>
      </p>
    </main>
  );
}
