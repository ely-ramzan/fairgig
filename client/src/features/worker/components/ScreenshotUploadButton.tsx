import { useRef } from 'react';
import { useUploadScreenshot } from '../../../hooks/useWorkerData';

interface ScreenshotUploadButtonProps {
  shiftId: string;
  disabled?: boolean;
  hasScreenshot?: boolean;
}

export function ScreenshotUploadButton({ shiftId, disabled, hasScreenshot }: ScreenshotUploadButtonProps) {
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
      <div className="flex flex-col items-end gap-0.5">
        <button
          type="button"
          disabled={disabled || upload.isPending}
          onClick={() => inputRef.current?.click()}
          className={
            'font-mono text-[9px] uppercase tracking-widest px-2 py-1 border rounded-sm disabled:opacity-40 ' +
            (upload.isSuccess || hasScreenshot
              ? 'border-jade text-jade hover:border-jade'
              : 'border-border text-t2 hover:border-amber')
          }
        >
          {upload.isPending
            ? '…'
            : upload.isSuccess || hasScreenshot
              ? '✓ Uploaded'
              : 'Screenshot'}
        </button>
        {upload.isError && (
          <span className="font-mono text-[9px] text-rust">Upload failed</span>
        )}
      </div>
    </>
  );
}
