import { useState } from 'react';
import { AppNav } from '../../components/shared/AppNav';
import { SerialHeader } from '../../components/shared/SerialHeader';
import { VerificationForm } from './components/VerificationForm';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { earningsApi } from '../../api/earnings';
import type { VerificationPayload } from '../../types/api';

export function VerificationQueuePage() {
  const qc = useQueryClient();
  const [current, setCurrent] = useState(0);

  const { data: queue, isPending } = useQuery({
    queryKey: ['verification-queue'],
    queryFn: () => earningsApi.verificationQueue({ page: 1, limit: 50 }).then((r) => r.data),
  });

  const submitVerification = useMutation({
    mutationFn: ({ shiftId, payload }: { shiftId: string; payload: VerificationPayload }) =>
      earningsApi.submitVerification(shiftId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['verification-queue'] });
      setCurrent((c) => c + 1);
    },
  });

  if (isPending) {
    return (
      <>
        <AppNav />
        <div className="flex items-center justify-center h-64 font-mono text-[10px] tracking-widest uppercase text-t4">
          Loading queue…
        </div>
      </>
    );
  }

  const shifts = queue?.items ?? [];
  const shift = shifts[current];

  if (!shift) {
    return (
      <>
        <AppNav />
        <div className="flex items-center justify-center h-64 font-mono text-[10px] tracking-widest uppercase text-t3">
          Queue empty — all shifts reviewed ✓
        </div>
      </>
    );
  }

  return (
    <>
      <AppNav />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <SerialHeader serial="03 —" label="Verification Queue" />
          <span className="font-mono text-[10px] text-t3">
            {current + 1} / {shifts.length}
          </span>
        </div>

        <div className="bg-surface border border-border rounded-lg p-6 flex flex-col gap-6">
          <div className="font-mono text-[10px] text-t3 space-y-1">
            <div>Shift {shift.id.slice(0, 8)}…</div>
            <div>Date {shift.shift_date}</div>
            <div>
              Gross {shift.gross_earned} · Net {shift.net_received} · Hours {shift.hours_worked}
            </div>
            <p className="text-t4 pt-2">Screenshot review wires in Phase 5.</p>
          </div>
          <VerificationForm
            onSubmit={(payload) => submitVerification.mutate({ shiftId: shift.id, payload })}
            isPending={submitVerification.isPending}
          />
        </div>
      </main>
    </>
  );
}
