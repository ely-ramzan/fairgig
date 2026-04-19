import { useForm }            from 'react-hook-form';
import { zodResolver }        from '@hookform/resolvers/zod';
import { useLogin }           from '../../../hooks/useAuth';
import { loginSchema, type LoginFormValues } from '../../../schemas/loginSchema';
import { useNavigate }        from 'react-router-dom';

export function LoginForm() {
  const navigate   = useNavigate();
  const login      = useLogin();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginFormValues) => {
    await login.mutateAsync(data);
    navigate('/dashboard');
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

      {login.isError && (
        <div className="font-mono text-[10px] text-rust text-center">
          Invalid credentials. Please try again.
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
