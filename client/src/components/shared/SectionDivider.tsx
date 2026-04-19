// Amber-dot section dividers — used between content sections.
export function SectionDivider({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 my-6">
      <div className="h-px flex-1 bg-border" />
      {label ? (
        <span className="font-mono text-[9px] tracking-widest uppercase text-t3 px-2">
          {label}
        </span>
      ) : (
        <span
          className="w-1.5 h-1.5 rounded-full bg-amber"
          aria-hidden="true"
        />
      )}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
