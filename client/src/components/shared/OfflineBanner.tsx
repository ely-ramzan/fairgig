import { useOnlineStatus } from '../../hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 w-full bg-rust/20 border-b border-rust text-rust font-mono text-[10px] text-center py-2 px-4"
    >
      You are offline — reconnect to sync data.
    </div>
  );
}
