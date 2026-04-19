// CertificatePage — always renders light (paper document), ignores app theme.
import { useState } from 'react';
import { useCertificateGenerateMutation, useCertificatePreview } from '../../hooks/useCertificate';
import { useCurrentUser } from '../../stores/authStore';
import { AppNav } from '../../components/shared/AppNav';

const CERT_STYLES: React.CSSProperties = {
  background: '#FDFAF5',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  color: '#1A160C',
  minHeight: '100vh',
  padding: '48px',
};

export function CertificatePage() {
  const user = useCurrentUser();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const previewParams = start && end ? { date_from: start, date_to: end } : null;
  const { data: preview } = useCertificatePreview(previewParams);

  const generate = useCertificateGenerateMutation();

  const html = generate.data;

  return (
    <>
      <AppNav />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-surface border border-border rounded-lg p-6 mb-8 flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">From</label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="font-mono text-[10px] tracking-widest uppercase text-t3">To</label>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-elevated border border-border rounded px-3 py-2 font-sans text-sm text-t1 focus:outline-none focus:border-amber"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!start || !end || !user?.id) return;
              generate.mutate({ date_from: start, date_to: end });
            }}
            disabled={!start || !end || generate.isPending}
            className="bg-amber text-bg font-mono text-[11px] tracking-widest uppercase px-4 py-2.5 rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {generate.isPending ? 'Generating…' : 'Generate'}
          </button>
        </div>

        {preview && (
          <div className="mb-6 bg-elevated border border-border rounded-lg p-4 font-mono text-[10px] text-t2 space-y-1">
            <div>Preview — {preview.worker_name}</div>
            <div>
              Net {preview.total_net} PKR · {preview.shift_count} shifts · Verified {preview.verified_count}
            </div>
          </div>
        )}

        {html && (
          <div data-theme="light" style={CERT_STYLES}>
            <div dangerouslySetInnerHTML={{ __html: html }} className="print:block" />
            <div className="mt-8 print:hidden flex justify-end">
              <button
                type="button"
                onClick={() => window.print()}
                className="font-mono text-[10px] tracking-widest uppercase px-4 py-2 border border-[#C8BEB0] text-[#6B6762] rounded hover:text-[#1A1915] transition-colors"
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
