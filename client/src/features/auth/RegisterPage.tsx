import { useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useRegister, useCityZones } from '../../hooks/useAuth';
import { SKIP_AUTH_FOR_TESTING } from '../../config/testAuth';
import { classifyAxiosError } from '../../lib/errors';
import { roleHome } from '../../lib/roleHome';

const ROLES = ['worker', 'verifier', 'advocate'] as const;
type Role = (typeof ROLES)[number];

const registerSchema = z
  .object({
    email: z.string().email('Invalid email'),
    password: z.string().min(8, 'Minimum 8 characters'),
    display_name: z.string().min(2, 'Name required'),
    role: z.enum(ROLES),
    city_zone_id: z.string().optional(),
  })
  .refine((d) => d.role !== 'worker' || !!d.city_zone_id, {
    message: 'City zone is required for workers',
    path: ['city_zone_id'],
  });

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();

  const register_mut = useRegister();
  const {
    data: zones,
    isLoading: zonesLoading,
    isError: zonesError,
    error: zonesErr,
    refetch: refetchZones,
  } = useCityZones();

  const initialRole = useMemo<Role>(() => {
    const r = search.get('role');
    return (ROLES as readonly string[]).includes(r ?? '') ? (r as Role) : 'worker';
  }, [search]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: initialRole },
  });

  // Keep form role in sync if the URL changes while the page is mounted.
  useEffect(() => {
    setValue('role', initialRole, { shouldValidate: false, shouldDirty: false });
  }, [initialRole, setValue]);

  const role = useWatch({ control, name: 'role' });

  const submitErrorMessage = register_mut.isError
    ? classifyAxiosError(register_mut.error).message
    : null;

  const zonesErrorMessage = zonesError
    ? classifyAxiosError(zonesErr).message
    : null;

  const onSubmit = async (data: RegisterFormValues) => {
    // Backend rejects city_zone_id for non-workers.
    const payload = {
      ...data,
      city_zone_id: data.role === 'worker' ? data.city_zone_id : undefined,
    };
    try {
      await register_mut.mutateAsync(payload);
      // Route by the newly-registered role — hardcoding /dashboard would 403
      // verifier/advocate accounts instantly.
      navigate(roleHome(data.role), { replace: true });
    } catch {
      // Error rendered via register_mut.isError below; nothing to do here.
    }
  };

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      {SKIP_AUTH_FOR_TESTING && (
        <div className="mb-6 w-full max-w-sm rounded-lg border border-amber/30 bg-amber-bg px-4 py-3 text-center">
          <Link
            to="/dev"
            className="font-mono text-[11px] tracking-widest uppercase text-amber hover:underline"
          >
            ← Screen map (no backend)
          </Link>
        </div>
      )}

      <div className="mb-8 text-center">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-amber mb-2">
          FAIRGIG
        </div>
        <h1 className="font-serif text-3xl text-t1">Create account</h1>
      </div>

      <div className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          {/* Role */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">
              Role
            </label>
            <select
              {...register('role')}
              className="fg-select-compatible bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
            >
              <option value="worker">Worker</option>
              <option value="verifier">Verifier</option>
              <option value="advocate">Advocate</option>
            </select>
          </div>

          {/* Display name */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">
              Display name <span className="text-rust">*</span>
            </label>
            <input
              {...register('display_name')}
              type="text"
              autoComplete="name"
              placeholder="Ali Hassan"
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber"
            />
            {errors.display_name && (
              <span className="font-mono text-[10px] text-rust">
                {errors.display_name.message}
              </span>
            )}
          </div>

          {/* Email */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">
              Email <span className="text-rust">*</span>
            </label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber"
            />
            {errors.email && (
              <span className="font-mono text-[10px] text-rust">{errors.email.message}</span>
            )}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">
              Password <span className="text-rust">*</span>
            </label>
            <input
              {...register('password')}
              type="password"
              autoComplete="new-password"
              placeholder="Min. 8 characters"
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber"
            />
            {errors.password && (
              <span className="font-mono text-[10px] text-rust">
                {errors.password.message}
              </span>
            )}
          </div>

          {/* City zone — workers only */}
          {role === 'worker' && (
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] tracking-widest uppercase text-t3">
                City Zone <span className="text-rust">*</span>
              </label>

              {zonesLoading ? (
                <div className="bg-elevated border border-border rounded px-3 py-2 font-mono text-[11px] text-t3">
                  Loading zones…
                </div>
              ) : zonesError ? (
                <div className="flex flex-col gap-2">
                  <div className="rounded border border-rust/40 bg-rust/10 px-3 py-2 font-mono text-[10px] text-rust">
                    Could not load city zones: {zonesErrorMessage}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => refetchZones()}
                      className="border border-border px-3 py-1.5 font-mono text-[10px] tracking-widest uppercase text-t1 hover:bg-elevated rounded"
                    >
                      Retry
                    </button>
                    <span className="font-mono text-[10px] text-t3">
                      or paste a zone UUID below
                    </span>
                  </div>
                  <input
                    {...register('city_zone_id')}
                    type="text"
                    placeholder="city zone uuid"
                    className="bg-elevated border border-border rounded px-3 py-2 font-mono text-xs text-t1 placeholder:text-t4 focus:outline-none focus:border-amber"
                  />
                </div>
              ) : zones && zones.length > 0 ? (
                <select
                  {...register('city_zone_id')}
                  defaultValue=""
                  className="fg-select-compatible bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
                >
                  <option value="">Select zone…</option>
                  {zones.map((z) => (
                    <option key={z.id} value={z.id}>
                      {z.city ? `${z.city} — ${z.name}` : z.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="rounded border border-amber/30 bg-amber-bg px-3 py-2 font-mono text-[10px] text-amber">
                  No city zones configured. Contact an administrator.
                </div>
              )}

              {errors.city_zone_id && (
                <span className="font-mono text-[10px] text-rust">
                  {errors.city_zone_id.message}
                </span>
              )}
            </div>
          )}

          {submitErrorMessage && (
            <div
              role="alert"
              className="rounded border border-rust/40 bg-rust/10 px-3 py-2 font-mono text-[10px] text-rust"
            >
              {submitErrorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || register_mut.isPending}
            className="mt-2 bg-amber text-bg font-mono text-[11px] tracking-widest uppercase py-2.5 rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {register_mut.isPending ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </div>

      <p className="font-sans text-sm text-t3 mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-amber hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
