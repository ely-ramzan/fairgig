import { useRef } from 'react';
import { useUploadScreenshot } from '../../../hooks/useWorkerData';

interface ScreenshotUploadButtonProps {
  shiftId: string;
  disabled?: boolean;
}

export function ScreenshotUploadButton({ shiftId, disabled }: ScreenshotUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadScreenshot();

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await upload.mutateAsync({ shiftId, file });
          e.target.value = '';
        }}
      />
      <button
        type="button"
        disabled={disabled || upload.isPending}
        onClick={() => inputRef.current?.click()}
        className="font-mono text-[9px] uppercase tracking-widest px-2 py-1 border border-border rounded-sm hover:border-amber text-t2 disabled:opacity-40"
      >
        {upload.isPending ? '…' : 'Screenshot'}
      </button>
    </>
  );
}
