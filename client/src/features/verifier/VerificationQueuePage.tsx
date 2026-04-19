import { useState }         from 'react';
import { AppNav }            from '../../components/shared/AppNav';
import { SerialHeader }      from '../../components/shared/SerialHeader';
import { ErrorState }        from '../../components/shared/ErrorState';
import { VerificationForm }  from './components/VerificationForm';
import { ScreenshotUploadButton } from '../worker/components/ScreenshotUploadButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { earningsApi }       from '../../api/earnings';
import type { VerificationPayload } from '../../types/api';

export function VerificationQueuePage() {
  const qc = useQueryClient();
  const [current, setCurrent] = useState(0);

  const { data: queue, isPending, isError, error, refetch } = useQuery({
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
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex flex-col gap-4 animate-pulse">
            <div className="h-4 w-48 bg-surface rounded" />
            <div className="h-40 bg-surface border border-border rounded-lg" />
            <div className="h-32 bg-surface border border-border rounded-lg" />
          </div>
        </div>
      </>
    );
  }

  if (isError) {
    return (
      <>
        <AppNav />
        <div className="max-w-2xl mx-auto px-4 py-8">
          <ErrorState error={error} onRetry={refetch} />
        </div>
      </>
    );
  }

  const shifts = queue?.items ?? [];
  const shift  = shifts[current];

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

  const commRate =
    shift.gross_earned > 0
      ? ((shift.platform_deductions / shift.gross_earned) * 100).toFixed(1)
      : '0.0';

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
          {/* Shift details */}
          <div className="flex flex-col gap-2">
            <div className="font-mono text-[9px] tracking-widest uppercase text-t4 mb-1">
              Shift details
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-[10px] text-t2">
              <span className="text-t3">ID</span>
              <span>{shift.id.slice(0, 12)}…</span>
              <span className="text-t3">Date</span>
              <span>{shift.shift_date}</span>
              <span className="text-t3">Gross (PKR)</span>
              <span>{shift.gross_earned.toLocaleString()}</span>
              <span className="text-t3">Deductions</span>
              <span>{shift.platform_deductions.toLocaleString()}</span>
              <span className="text-t3">Net (PKR)</span>
              <span>{shift.net_received.toLocaleString()}</span>
              <span className="text-t3">Hours</span>
              <span>{shift.hours_worked}h</span>
              <span className="text-t3">Commission</span>
              <span className={Number(commRate) > 25 ? 'text-rust' : ''}>{commRate}%</span>
            </div>
          </div>

          {/* Screenshot upload for this shift */}
          <div className="flex flex-col gap-2 border-t border-border pt-4">
            <div className="font-mono text-[9px] tracking-widest uppercase text-t4">
              Shift screenshot
            </div>
            <div className="flex items-center gap-3">
              <ScreenshotUploadButton shiftId={shift.id} />
              <span className="font-sans text-xs text-t3">
                Upload the earnings screenshot to attach evidence before verifying.
              </span>
            </div>
          </div>

          {submitVerification.isError && (
            <div className="font-mono text-[10px] text-rust">
              Verification failed — please try again.
            </div>
          )}

          <VerificationForm
            onSubmit={(payload) => submitVerification.mutate({ shiftId: shift.id, payload })}
            isPending={submitVerification.isPending}
          />
        </div>
      </main>
    </>
  );
}
