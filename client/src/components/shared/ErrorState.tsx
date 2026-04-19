import { Link } from 'react-router-dom';
import { classifyAxiosError } from '../../lib/errors';

interface ErrorStateProps {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}

function isServiceUnavailable(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'SERVICE_UNAVAILABLE'
  );
}

export function ErrorState({
  error,
  title = 'Could not load data',
  onRetry,
}: ErrorStateProps) {
  const classified = classifyAxiosError(error);
  const unavailable = isServiceUnavailable(error);

  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-4 py-12 px-4 text-center border border-border rounded-sm bg-surface"
    >
      <p className="font-mono text-[10px] tracking-widest uppercase text-rust">
        {unavailable ? 'Service unavailable' : title}
      </p>
      <p className="font-sans text-sm text-t2 max-w-md">{classified.message}</p>
      <div className="flex items-center gap-2">
        {onRetry && !unavailable && (
          <button
            type="button"
            className="font-mono text-[10px] uppercase tracking-widest px-4 py-2 border border-border bg-elevated hover:bg-border/30"
            onClick={onRetry}
          >
            Retry
          </button>
        )}
        {unavailable && (
          <Link
            to="/settings/services"
            className="font-mono text-[10px] uppercase tracking-widest px-4 py-2 border border-amber bg-amber-bg text-amber hover:bg-amber hover:text-bg transition-colors"
          >
            Configure services
          </Link>
        )}
      </div>
    </div>
  );
}
