// Verification status pill component.
type Status = 'pending' | 'verified' | 'disputed' | 'unverifiable';

const STATUS_STYLES: Record<Status, { bg: string; text: string; label: string }> = {
  pending:      { bg: 'bg-amber/10 border border-amber/20',   text: 'text-amber',       label: 'Pending' },
  verified:     { bg: 'bg-jade/10  border border-jade/20',    text: 'text-jade',        label: 'Verified' },
  disputed:     { bg: 'bg-rust/10  border border-rust/20',    text: 'text-rust',        label: 'Disputed' },
  unverifiable: { bg: 'bg-slate/10 border border-slate-bg',   text: 'text-slate',       label: 'Unverifiable' },
};

export function StatusPill({ status }: { status: Status }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] tracking-wide ${s.bg} ${s.text}`}
    >
      {s.label}
    </span>
  );
}
