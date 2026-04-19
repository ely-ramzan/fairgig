// 4-stat summary card used on all dashboards.
interface KpiCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  accent?: boolean;
}

export function KpiCard({ label, value, subtext, accent = false }: KpiCardProps) {
  const display = typeof value === 'number' && Number.isFinite(value) ? String(value) : String(value);
  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-2">
      <div className="font-mono text-[9px] tracking-widest uppercase text-t3">
        {label}
      </div>
      <div
        className={`font-serif text-2xl leading-none ${accent ? 'text-amber' : 'text-t1'}`}
      >
        {display}
      </div>
      {subtext && (
        <div className="font-sans text-xs text-t3">{subtext}</div>
      )}
    </div>
  );
}
