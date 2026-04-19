interface SkeletonBlockProps {
  className?: string;
  lines?: number;
}

export function SkeletonBlock({ className = '', lines = 1 }: SkeletonBlockProps) {
  return (
    <div className={`animate-pulse flex flex-col gap-2 ${className}`} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-elevated rounded-sm w-full max-w-md" style={{ width: `${85 - i * 10}%` }} />
      ))}
    </div>
  );
}
