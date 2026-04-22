import { useForm, useWatch } from 'react-hook-form';
import { zodResolver }     from '@hookform/resolvers/zod';
import { z }               from 'zod';
import type { VerificationPayload } from '../../../types/api';

const verificationSchema = z.object({
  status: z.enum(['verified', 'disputed', 'unverifiable']),
  notes: z.string().optional(),
  verifier_gross: z.number().optional(),
  verifier_deductions: z.number().optional(),
}).refine(
  (d) => d.status === 'verified' || (d.notes && d.notes.trim().length >= 5),
  { message: 'Notes are required when disputing or marking unverifiable', path: ['notes'] },
);

type FormValues = z.infer<typeof verificationSchema>;

interface VerificationFormProps {
  onSubmit: (payload: VerificationPayload) => void;
  isPending: boolean;
}

export function VerificationForm({ onSubmit, isPending }: VerificationFormProps) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(verificationSchema), defaultValues: { status: 'verified' } });

  const status = useWatch({ control, name: 'status' });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {/* Status */}
      <div className="flex gap-2">
        {(['verified', 'disputed', 'unverifiable'] as const).map((s) => (
          <label key={s} className="flex-1">
            <input {...register('status')} type="radio" value={s} className="sr-only peer" />
            <div className={`text-center py-2 rounded border font-mono text-[10px] tracking-widest uppercase cursor-pointer transition-colors peer-checked:bg-amber peer-checked:border-amber peer-checked:text-bg peer-checked:font-bold border-border text-t3 hover:border-t2`}>
              {s}
            </div>
          </label>
        ))}
      </div>

      {/* Status description — always visible so verifier knows what they're submitting */}
      <div className="bg-elevated border border-border rounded px-3 py-2 font-mono text-[10px] text-t2 leading-relaxed">
        {status === 'verified' && (
          <span>
            <span className="text-amber font-bold">✓ VERIFIED</span>
            <span className="text-t3"> — numbers match the screenshot. No edits needed. Clicking submit will approve this shift as-is.</span>
          </span>
        )}
        {status === 'disputed' && (
          <span>
            <span className="text-amber font-bold">⚠ DISPUTED</span>
            <span className="text-t3"> — numbers don't match. Enter what you see in the screenshot below and explain the discrepancy.</span>
          </span>
        )}
        {status === 'unverifiable' && (
          <span>
            <span className="text-amber font-bold">✗ UNVERIFIABLE</span>
            <span className="text-t3"> — screenshot is missing, illegible, or fraudulent. Explain why in notes.</span>
          </span>
        )}
      </div>

      {/* Verifier reads — only shown when disputing */}
      {status === 'disputed' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Verifier Gross (PKR)</label>
            <input {...register('verifier_gross', { valueAsNumber: true })} type="number" min="0"
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Verifier Deductions</label>
            <input {...register('verifier_deductions', { valueAsNumber: true })} type="number" min="0"
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber" />
          </div>
        </div>
      )}

      {/* Notes */}
      {status !== 'verified' && (
        <div className="flex flex-col gap-1">
          <label className="font-mono text-[10px] tracking-widest uppercase text-t3">Notes</label>
          <textarea {...register('notes')} rows={3} placeholder="Explain the discrepancy…"
            className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 placeholder:text-t4 focus:outline-none focus:border-amber resize-none" />
          {errors.notes && <span className="font-mono text-[10px] text-rust">{errors.notes.message}</span>}
        </div>
      )}

      <button type="submit" disabled={isPending}
        className="bg-amber text-bg font-mono text-[11px] tracking-widest uppercase py-2.5 rounded hover:opacity-90 disabled:opacity-40 transition-opacity">
        {isPending ? 'Submitting…' : 'Submit verdict'}
      </button>
    </form>
  );
}
