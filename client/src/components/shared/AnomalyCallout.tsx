// Amber left-border callout box for anomaly alerts and warnings.
interface AnomalyCalloutProps {
  title:    string;
  message:  string;
  severity?: 'low' | 'medium' | 'high';
}

const SEVERITY_COLOR: Record<string, string> = {
  low:    'border-l-amber/40',
  medium: 'border-l-amber',
  high:   'border-l-rust',
};

export function AnomalyCallout({ title, message, severity = 'medium' }: AnomalyCalloutProps) {
  const borderColor = SEVERITY_COLOR[severity] ?? SEVERITY_COLOR.medium;

  return (
    <div
      className={`bg-amber-bg border-l-2 ${borderColor} rounded-r-lg px-4 py-3`}
      role="alert"
    >
      <div className="font-mono text-[10px] tracking-widest uppercase text-amber mb-1">
        {title}
      </div>
      <div className="font-sans text-sm text-t2">{message}</div>
    </div>
  );
}
