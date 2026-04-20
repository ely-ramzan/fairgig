import { useState } from 'react';
import { isAxiosError }     from 'axios';
import { AppNav }            from '../../components/shared/AppNav';
import { SerialHeader }      from '../../components/shared/SerialHeader';
import { ErrorState }        from '../../components/shared/ErrorState';
import { VerificationForm }  from './components/VerificationForm';
import { ScreenshotReview }  from './components/ScreenshotReview';
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
    },
  });

  const shifts = queue?.items ?? [];

  // Clamp on read — no effect needed, avoids cascading renders.
  const safeCurrent = shifts.length === 0 ? 0 : Math.min(current, shifts.length - 1);
  const shift = shifts[safeCurrent];
  const { data: screenshotMeta, isFetching: shotLoading } = useQuery({
    queryKey: ['shift-screenshot', shift?.id],
    queryFn: async () => {
      if (!shift?.id) return null;
      try {
        const r = await earningsApi.getScreenshot(shift.id, true);
        return r.data;
      } catch (e) {
        if (isAxiosError(e) && e.response?.status === 404) return null;
        throw e;
      }
    },
    enabled: !!shift?.id,
    staleTime: 1000 * 30,
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

  const pendingCount = queue?.total ?? shifts.length;

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
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setCurrent((c) => Math.max(0, c - 1))}
              className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 border border-border rounded-sm text-t2 hover:text-t1 disabled:opacity-30 transition-colors"
            >
              ← Prev
            </button>
            <span className="font-mono text-[10px] text-t3">
              {current + 1} / {shifts.length}
              <span className="text-t4"> · {pendingCount} pending</span>
            </span>
            <button
              type="button"
              disabled={current >= shifts.length - 1}
              onClick={() => setCurrent((c) => Math.min(shifts.length - 1, c + 1))}
              className="font-mono text-[10px] uppercase tracking-widest px-2 py-1 border border-border rounded-sm text-t2 hover:text-t1 disabled:opacity-30 transition-colors"
            >
              Next →
            </button>
          </div>
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
              {shift.platform_name && (
                <>
                  <span className="text-t3">Platform</span>
                  <span>{shift.platform_name}</span>
                </>
              )}
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

          {/* Screenshot review (read-only — only the worker can upload) */}
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="font-mono text-[9px] tracking-widest uppercase text-t4">
              Shift screenshot
            </div>
            {shotLoading ? (
              <div className="h-40 bg-elevated border border-border rounded-lg animate-pulse" />
            ) : screenshotMeta?.url ? (
              <ScreenshotReview
                cloudinaryUrl={screenshotMeta.url}
                workerName={`Worker ${shift.worker_id.slice(0, 8)}…`}
                shiftDate={shift.shift_date}
              />
            ) : (
              <p className="font-mono text-[10px] text-t4">
                No screenshot uploaded — consider marking this shift <span className="text-t2">unverifiable</span>.
              </p>
            )}
          </div>

          {submitVerification.isError && (
            <div className="font-mono text-[10px] text-rust bg-rust/10 border border-rust/30 rounded px-3 py-2">
              {(() => {
                const e = submitVerification.error as unknown;
                if (isAxiosError(e)) {
                  const resp = e.response;
                  if (!resp) {
                    return `Network error — ${e.message}. Check that the earnings service is up.`;
                  }
                  const data = resp.data as { detail?: string; message?: string; type?: string } | undefined;
                  const body = data?.detail || data?.message;
                  const kind = data?.type ? ` (${data.type})` : '';
                  return `Server returned ${resp.status}${kind}${body ? ` — ${body}` : ''}`;
                }
                return 'Verification failed — please try again.';
              })()}
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
