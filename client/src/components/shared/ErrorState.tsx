import { classifyAxiosError } from '../../lib/errors';

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}

export function ErrorState({ error, title = 'Could not load data', onRetry }: ErrorStateProps) {
  const classified = classifyAxiosError(error);
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center border border-border rounded-sm bg-surface"
    >
      <p className="font-mono text-[10px] tracking-widest uppercase text-rust">{title}</p>
      <p className="font-sans text-sm text-t2 max-w-md">{classified.message}</p>
      {onRetry && (
        <button
          type="button"
          className="font-mono text-[10px] uppercase tracking-widest px-4 py-2 border border-border bg-elevated hover:bg-border/30"
          onClick={onRetry}
        >
          Retry
        </button>
      )}
    </div>
  );
}
