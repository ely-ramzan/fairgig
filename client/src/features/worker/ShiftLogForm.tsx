import { useForm }       from 'react-hook-form';
import { zodResolver }   from '@hookform/resolvers/zod';
import { AppNav }        from '../../components/shared/AppNav';
import { SerialHeader }  from '../../components/shared/SerialHeader';
import { useCreateShift } from '../../hooks/useShifts';
import { shiftSchema, type ShiftFormValues } from '../../schemas/shiftSchema';
import { useNavigate }   from 'react-router-dom';

export function ShiftLogForm() {
  const navigate    = useNavigate();
  const createShift = useCreateShift();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormValues>({ resolver: zodResolver(shiftSchema) });

  const onSubmit = async (data: ShiftFormValues) => {
    await createShift.mutateAsync(data);
    navigate('/shifts');
  };

  return (
    <>
      <AppNav />
      <main className="max-w-lg mx-auto px-4 py-8">
        <SerialHeader serial="02 —" label="Log a Shift" />

        <div className="bg-surface border border-border rounded-lg p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">

            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Platform</label>
              <input {...register('platform_id')} type="text" placeholder="Platform ID (UUID)"
                className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber" />
              {errors.platform_id && <span className="font-mono text-[10px] text-rust">{errors.platform_id.message}</span>}
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Date</label>
              <input {...register('shift_date')} type="date"
                className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber" />
              {errors.shift_date && <span className="font-mono text-[10px] text-rust">{errors.shift_date.message}</span>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Hours worked</label>
                <input {...register('hours_worked', { valueAsNumber: true })} type="number" step="0.5" min="0.5"
                  className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber" />
                {errors.hours_worked && <span className="font-mono text-[10px] text-rust">{errors.hours_worked.message}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Gross earned (PKR)</label>
                <input {...register('gross_earned', { valueAsNumber: true })} type="number" min="1"
                  className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber" />
                {errors.gross_earned && <span className="font-mono text-[10px] text-rust">{errors.gross_earned.message}</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Platform deductions</label>
                <input {...register('platform_deductions', { valueAsNumber: true })} type="number" min="0"
                  className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber" />
                {errors.platform_deductions && <span className="font-mono text-[10px] text-rust">{errors.platform_deductions.message}</span>}
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Net received</label>
                <input {...register('net_received', { valueAsNumber: true })} type="number" min="0"
                  className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber" />
                {errors.net_received && <span className="font-mono text-[10px] text-rust">{errors.net_received.message}</span>}
              </div>
            </div>

            {createShift.isError && (
              <div className="font-mono text-[10px] text-rust">Failed to save shift. Please try again.</div>
            )}

            <div className="flex gap-3 mt-2">
              <button type="button" onClick={() => navigate('/shifts')}
                className="flex-1 py-2.5 rounded border border-border font-mono text-[11px] tracking-widest uppercase text-t2 hover:text-t1 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isSubmitting || createShift.isPending}
                className="flex-1 bg-amber text-bg font-mono text-[11px] tracking-widest uppercase py-2.5 rounded hover:opacity-90 disabled:opacity-40 transition-opacity">
                {createShift.isPending ? 'Saving…' : 'Log shift'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
