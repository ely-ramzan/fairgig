// Displays a single screenshot for verifier review.
interface ScreenshotReviewProps {
  cloudinaryUrl: string;
  workerName:    string;
  shiftDate:     string;
}

export function ScreenshotReview({ cloudinaryUrl, workerName, shiftDate }: ScreenshotReviewProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-sans text-sm text-t1">{workerName}</div>
          <div className="font-mono text-[10px] text-t3">{shiftDate}</div>
        </div>
        <a
          href={cloudinaryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] tracking-widest uppercase text-amber hover:underline"
        >
          Full size ↗
        </a>
      </div>
      <div className="rounded-lg overflow-hidden border border-border bg-elevated">
        <img
          src={cloudinaryUrl}
          alt={`Earnings screenshot — ${workerName}`}
          className="w-full object-contain max-h-96"
          loading="lazy"
        />
      </div>
    </div>
  );
}
