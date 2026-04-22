import { useRef, useState } from 'react';
import { AppNav } from '../../components/shared/AppNav';
import { SerialHeader } from '../../components/shared/SerialHeader';
import { useImportCsv } from '../../hooks/useShifts';
import { useImportHistory } from '../../hooks/useWorkerData';
import { useNavigate } from 'react-router-dom';
import { ImportResultCard } from './components/ImportResultCard';
import { ImportHistoryList } from './components/ImportHistoryList';
import type { CsvImportResponse } from '../../types/api';

export function CsvImportPage() {
  const navigate = useNavigate();
  const importCsv = useImportCsv();
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: history } = useImportHistory();
  const [lastResult, setLastResult] = useState<CsvImportResponse | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await importCsv.mutateAsync(fd);
      setLastResult(res);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Import failed. Check file format.');
      setLastResult(null);
    }
    e.target.value = '';
  };

  return (
    <>
      <AppNav />
      <main className="max-w-lg mx-auto px-4 py-8">
        <SerialHeader serial="02 —" label="Import CSV" />
        <div className="bg-surface border border-border rounded-lg p-8 flex flex-col items-center gap-4">
          <p className="font-sans text-sm text-t2 text-center">
            Upload a CSV or Excel file with your shift history.
            <br />
            Max size: <span className="font-mono text-t1">10 MB</span>
          </p>

          <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={importCsv.isPending}
            className="bg-amber text-bg font-mono text-[11px] tracking-widest uppercase px-6 py-2.5 rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {importCsv.isPending ? 'Importing…' : 'Choose file'}
          </button>

          {(importCsv.isError || fileError) && (
            <div className="font-mono text-[10px] text-rust">
              {fileError ?? 'Import failed. Check file format.'}
            </div>
          )}

          {lastResult && <ImportResultCard result={lastResult} />}

          <div className="w-full mt-4">
            <div className="font-mono text-[9px] uppercase tracking-widest text-t3 mb-2">Import history</div>
            <ImportHistoryList items={history ?? []} />
          </div>

          <button
            type="button"
            onClick={() => navigate('/shifts')}
            className="font-mono text-[10px] uppercase text-t3 border border-border px-4 py-2 rounded-sm mt-2"
          >
            View shifts
          </button>
        </div>
      </main>
    </>
  );
}
