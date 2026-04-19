// CertificatePage — always renders light (paper document), ignores app theme.
import { useState }  from 'react';
import { useCertificateGenerateMutation, useCertificatePreview } from '../../hooks/useCertificate';
import { AppNav }         from '../../components/shared/AppNav';
import { SerialHeader }   from '../../components/shared/SerialHeader';
import { formatPKR }      from '../../lib/formatting';

export function CertificatePage() {
  const [start, setStart] = useState('');
  const [end,   setEnd]   = useState('');

  const dateError = start && end && start > end
    ? 'Start date must be before end date'
    : null;

  const previewParams = start && end && !dateError ? { date_from: start, date_to: end } : null;
  const { data: preview } = useCertificatePreview(previewParams);

  const generate = useCertificateGenerateMutation();
  const html = generate.data;

  return (
    <>
      <AppNav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <SerialHeader serial="06 —" label="Income certificate" />
        <div className="bg-surface border border-border rounded-lg p-6 mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">
              From <span className="text-rust">*</span>
            </label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">
              To <span className="text-rust">*</span>
            </label>
            <input
              type="date"
              value={end}
              min={start || undefined}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
            />
          </div>
          <div className="flex flex-col gap-1">
            {dateError && (
              <span className="font-mono text-[10px] text-rust mb-1">{dateError}</span>
            )}
            <button
              type="button"
              onClick={() => {
                if (!start || !end || dateError) return;
                generate.mutate({ date_from: start, date_to: end });
              }}
              disabled={!start || !end || !!dateError || generate.isPending}
              className="bg-amber text-bg font-mono text-[11px] tracking-widest uppercase px-4 py-2.5 rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {generate.isPending ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </div>

        {generate.isError && (
          <div className="mb-4 font-mono text-[10px] text-rust">
            Could not generate certificate — check your date range or try again.
          </div>
        )}

        {preview && (
          <div className="mb-6 bg-elevated border border-border rounded-lg p-4 font-mono text-[10px] text-t2 space-y-1">
            <div>Preview — {preview.worker_name}</div>
            <div>
              Net {formatPKR(Number(preview.total_net), true)} · {preview.shift_count} shifts · Verified{' '}
              {preview.verified_count}
            </div>
          </div>
        )}

        {html && (
          <div>
            {/* Use iframe srcdoc to sandbox the HTML — prevents any script execution
                even if the backend template were ever tampered with. */}
            <iframe
              srcDoc={html}
              title="Income Certificate"
              className="w-full border border-border rounded-lg"
              style={{ minHeight: '80vh', background: '#FDFAF5' }}
              sandbox="allow-same-origin"
            />
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => window.print()}
                className="font-mono text-[10px] tracking-widest uppercase px-4 py-2 border border-border rounded text-t2 hover:text-t1 transition-colors"
              >
                Print / Save PDF
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  );
}
