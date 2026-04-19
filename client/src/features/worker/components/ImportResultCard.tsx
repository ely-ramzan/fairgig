import type { CsvImportResponse } from '../../../types/api';

interface ImportResultCardProps {
  result: CsvImportResponse;
}

export function ImportResultCard({ result }: ImportResultCardProps) {
  return (
    <div className="border border-border rounded-sm p-4 bg-elevated font-mono text-[10px] space-y-2">
      <div className="uppercase tracking-widest text-t3">Import result</div>
      <div>Rows imported: {result.rows_imported}</div>
      <div>Rows with errors: {result.rows_errored}</div>
      {result.errors?.length > 0 && (
        <details className="text-t2">
          <summary className="cursor-pointer text-rust">Error details</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words text-[9px]">{JSON.stringify(result.errors, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}
