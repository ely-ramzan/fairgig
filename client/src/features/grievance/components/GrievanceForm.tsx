import { useForm }          from 'react-hook-form';
import { zodResolver }      from '@hookform/resolvers/zod';
import { z }               from 'zod';
import { useCreateGrievance } from '../../../hooks/useGrievances';
import { usePlatforms }    from '../../../hooks/useWorkerData';

const CATEGORIES = [
  'commission_change', 'deactivation', 'payment_delay',
  'unfair_rating', 'safety', 'other',
] as const;

const grievanceFormSchema = z.object({
  platform_id:  z.string().min(1, 'Platform is required'),
  category:     z.enum(CATEGORIES),
  description:  z.string().min(10, 'Minimum 10 characters'),
  is_anonymous: z.boolean(),
});

type GrievanceFormValues = z.infer<typeof grievanceFormSchema>;

interface GrievanceFormProps {
  onSuccess?: () => void;
}

export function GrievanceForm({ onSuccess }: GrievanceFormProps) {
  const create = useCreateGrievance();
  const { data: platforms = [] } = usePlatforms();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GrievanceFormValues>({
    resolver: zodResolver(grievanceFormSchema),
    defaultValues: { is_anonymous: true, category: 'commission_change' },
  });

  const onSubmit = async (data: GrievanceFormValues) => {
    await create.mutateAsync(data);
    reset();
    onSuccess?.();
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Platform</label>
          <select
            {...register('platform_id')}
            className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
          >
            <option value="">Select a platform…</option>
            {platforms.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {errors.platform_id && <span className="font-mono text-[10px] text-rust">{errors.platform_id.message}</span>}
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Category</label>
          <select {...register('category')}
            className="fg-select-compatible bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Description</label>
        <textarea {...register('description')} rows={4} placeholder="Describe the issue in detail…"
          className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber resize-none" />
        {errors.description && <span className="font-mono text-[10px] text-rust">{errors.description.message}</span>}
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input {...register('is_anonymous')} type="checkbox"
          className="accent-amber" />
        <span className="font-sans text-sm text-t2">Post anonymously</span>
      </label>

      <button type="submit" disabled={isSubmitting || create.isPending}
        className="bg-amber text-bg font-mono text-[11px] tracking-widest uppercase py-2.5 rounded hover:opacity-90 disabled:opacity-40 transition-opacity">
        {create.isPending ? 'Submitting…' : 'Submit grievance'}
      </button>
    </form>
  );
}
