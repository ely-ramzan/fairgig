import { useEffect, useState } from 'react';

interface ScreenshotReviewProps {
  cloudinaryUrl: string;
  workerName:    string;
  shiftDate:     string;
}

export function ScreenshotReview({ cloudinaryUrl, workerName, shiftDate }: ScreenshotReviewProps) {
  const [trackedUrl, setTrackedUrl] = useState(cloudinaryUrl);
  const [broken, setBroken] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  if (cloudinaryUrl !== trackedUrl) {
    setTrackedUrl(cloudinaryUrl);
    setBroken(false);
    setModalOpen(false);
  }

  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [modalOpen]);

  const openModal = () => {
    if (!broken) setModalOpen(true);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-sans text-sm text-t1">{workerName}</div>
          <div className="font-mono text-[10px] text-t3">{shiftDate}</div>
        </div>
        <button
          type="button"
          onClick={openModal}
          disabled={broken}
          className="font-mono text-[10px] tracking-widest uppercase text-amber hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Full size ↗
        </button>
      </div>

      <div className="rounded-lg border border-border bg-elevated">
        {broken ? (
          <div className="h-20 flex flex-col items-center justify-center gap-1 font-mono text-[10px] text-t4 text-center px-4">
            <span className="text-t3">Screenshot could not be loaded</span>
            <span className="text-[9px]">Consider marking this shift unverifiable.</span>
          </div>
        ) : (
          <div className="h-20 flex items-center justify-center font-mono text-[10px] tracking-widest uppercase text-t4">
            Screenshot available — use Full size ↗
          </div>
        )}
        {/* hidden img to detect broken links */}
        {!broken && (
          <img
            src={cloudinaryUrl}
            alt=""
            className="hidden"
            onError={() => setBroken(true)}
          />
        )}
      </div>

      {modalOpen && !broken && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot preview"
          onClick={() => setModalOpen(false)}
          className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm overflow-y-auto p-4 sm:p-8"
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setModalOpen(false);
            }}
            aria-label="Close"
            className="fixed top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white font-mono text-lg transition-colors z-10"
          >
            ×
          </button>

          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-2xl mx-auto flex flex-col gap-3"
          >
            <div className="flex items-baseline justify-between text-white font-mono text-[11px] tracking-widest uppercase">
              <span>{workerName}</span>
              <span className="text-white/60">{shiftDate}</span>
            </div>
            <img
              src={cloudinaryUrl}
              alt={`Earnings screenshot — ${workerName}`}
              className="max-w-full object-contain rounded-lg bg-white"
              onError={() => {
                setBroken(true);
                setModalOpen(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
