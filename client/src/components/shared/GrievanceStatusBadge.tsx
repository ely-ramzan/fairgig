type GStatus = 'open' | 'escalated' | 'resolved';

const STYLES: Record<GStatus, string> = {
  open: 'border-amber text-amber bg-amber/10',
  escalated: 'border-rust text-rust bg-rust/10',
  resolved: 'border-jade text-jade bg-jade/10',
};

export function GrievanceStatusBadge({ status }: { status: GStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full font-mono text-[10px] tracking-wide border ${STYLES[status]}`}
    >
      {status}
    </span>
  );
}
