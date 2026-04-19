// Section eyebrow / serial number header in JetBrains Mono.
interface SerialHeaderProps {
  serial: string; // e.g. "01 —" or "EARNINGS"
  label:  string;
}

export function SerialHeader({ serial, label }: SerialHeaderProps) {
  return (
    <div className="flex items-baseline gap-2 mb-4">
      <span className="font-mono text-[10px] tracking-widest text-amber uppercase">
        {serial}
      </span>
      <h2 className="font-serif text-xl text-t1">{label}</h2>
    </div>
  );
}
