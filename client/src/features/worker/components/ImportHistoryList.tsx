import type { ImportRecord } from '../../../types/api';
import { formatDate } from '../../../lib/formatting';

interface ImportHistoryListProps {
  items: ImportRecord[];
}

export function ImportHistoryList({ items }: ImportHistoryListProps) {
  if (items.length === 0) {
    return <p className="font-mono text-[10px] text-t4 py-4">No imports yet.</p>;
  }
  return (
    <ul className="divide-y divide-border border border-border rounded-sm">
      {items.map((u) => (
        <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 font-mono text-[10px]">
          <span className="text-t1 truncate max-w-[200px]">{u.original_filename}</span>
          <span className="text-t3">
            {u.rows_imported} ok / {u.rows_errored} err
          </span>
          <span className="uppercase text-t2">{u.import_status}</span>
          <span className="text-t4 w-full sm:w-auto">{formatDate(u.uploaded_at)}</span>
        </li>
      ))}
    </ul>
  );
}
