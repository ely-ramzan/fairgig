import { useForm }      from 'react-hook-form';
import { zodResolver }  from '@hookform/resolvers/zod';
import { z }            from 'zod';
import { Link, useNavigate } from 'react-router-dom';
import { useRegister, useCityZones } from '../../hooks/useAuth';
import { SKIP_AUTH_FOR_TESTING } from '../../config/testAuth';

const registerSchema = z.object({
  email:        z.string().email('Invalid email'),
  password:     z.string().min(8, 'Minimum 8 characters'),
  display_name: z.string().min(2, 'Name required'),
  role:         z.enum(['worker', 'verifier', 'advocate']),
  city_zone_id: z.string().optional(),
}).refine(
  (d) => d.role !== 'worker' || !!d.city_zone_id,
  { message: 'City zone is required for workers', path: ['city_zone_id'] },
);

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const navigate     = useNavigate();
  const register_mut = useRegister();
  const { data: zones } = useCityZones();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver:      zodResolver(registerSchema),
    defaultValues: { role: 'worker' },
  });

  const role = watch('role');

  const onSubmit = async (data: RegisterFormValues) => {
    await register_mut.mutateAsync(data);
    navigate('/dashboard');
  };

  return (
    <main className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      {SKIP_AUTH_FOR_TESTING && (
        <div className="mb-6 w-full max-w-sm rounded-lg border border-amber/30 bg-amber-bg px-4 py-3 text-center">
          <Link to="/dev" className="font-mono text-[11px] tracking-widest uppercase text-amber hover:underline">
            ← Screen map (no backend)
          </Link>
        </div>
      )}

      <div className="mb-8 text-center">
        <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-amber mb-2">FAIRGIG</div>
        <h1 className="font-serif text-3xl text-t1">Create account</h1>
      </div>

      <div className="bg-surface border border-border rounded-xl p-8 w-full max-w-sm">
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

          {/* Role */}
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Role</label>
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
              placeholder="Ali Hassan"
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber"
            />
            {errors.display_name && (
              <span className="font-mono text-[10px] text-rust">{errors.display_name.message}</span>
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
              placeholder="Min. 8 characters"
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber"
            />
            {errors.password && (
              <span className="font-mono text-[10px] text-rust">{errors.password.message}</span>
            )}
          </div>

          {/* City zone — workers only */}
          {role === 'worker' && (
            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] tracking-widest uppercase text-t3">
                City Zone <span className="text-rust">*</span>
              </label>
              <select
                {...register('city_zone_id')}
                className="fg-select-compatible bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
              >
                <option value="">Select zone…</option>
                {zones?.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
              {errors.city_zone_id && (
                <span className="font-mono text-[10px] text-rust">{errors.city_zone_id.message}</span>
              )}
            </div>
          )}

          {register_mut.isError && (
            <div className="font-mono text-[10px] text-rust text-center">
              Registration failed — email may already be in use.
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
        <Link to="/login" className="text-amber hover:underline">Sign in</Link>
      </p>
    </main>
  );
}
