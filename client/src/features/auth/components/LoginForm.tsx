import { useForm }            from 'react-hook-form';
import { zodResolver }        from '@hookform/resolvers/zod';
import { useLogin }           from '../../../hooks/useAuth';
import { loginSchema, type LoginFormValues } from '../../../schemas/loginSchema';
import { useLocation, useNavigate } from 'react-router-dom';
import { classifyAxiosError } from '../../../lib/errors';
import { useAuthStore } from '../../../stores/authStore';

function roleHome(role: string | null | undefined): string {
  switch (role) {
    case 'verifier':
      return '/verify';
    case 'advocate':
      return '/analytics';
    case 'worker':
    default:
      return '/dashboard';
  }
}

export function LoginForm() {
  const navigate   = useNavigate();
  const location   = useLocation();
  const login      = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const loginError = login.isError ? classifyAxiosError(login.error).message : null;

  const onSubmit = async (data: LoginFormValues) => {
    try {
      await login.mutateAsync(data);
      // Read role *after* the mutation — useLogin.onSuccess has already populated the store.
      const role = useAuthStore.getState().user?.role ?? null;
      const state = location.state as { from?: string } | null;
      const target =
        state?.from && state.from !== '/login' ? state.from : roleHome(role);
      navigate(target, { replace: true });
    } catch {
      // Inline error rendered below; nothing to do here.
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 w-full max-w-sm">
      <div className="flex flex-col gap-1">
        <label className="font-mono text-[10px] tracking-widest uppercase text-t3">
          Email
        </label>
        <input
          {...register('email')}
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber transition-colors"
        />
        {errors.email && (
          <span className="font-mono text-[10px] text-rust">{errors.email.message}</span>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-[10px] tracking-widest uppercase text-t3">
          Password
        </label>
        <input
          {...register('password')}
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber transition-colors"
        />
        {errors.password && (
          <span className="font-mono text-[10px] text-rust">{errors.password.message}</span>
        )}
      </div>

      {loginError && (
        <div
          role="alert"
          className="rounded border border-rust/40 bg-rust/10 px-3 py-2 font-mono text-[10px] text-rust text-center"
        >
          {loginError}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting || login.isPending}
        className="mt-2 bg-amber text-bg font-mono text-[11px] tracking-widest uppercase py-2.5 rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
      >
        {login.isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
