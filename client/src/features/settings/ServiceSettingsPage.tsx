import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SERVICE_KEYS,
  SERVICE_LABELS,
  clearServiceOverrides,
  getEnv,
  setServiceOverrides,
  type ServiceKey,
} from '../../config/env';

type FormState = Record<ServiceKey, string>;

function buildInitial(): FormState {
  const env = getEnv();
  const state = {} as FormState;
  for (const key of SERVICE_KEYS) {
    state[key] = env.resolved[key] ?? '';
  }
  return state;
}

/**
 * Runtime-configurable service URL panel.
 *
 * Changes are written to localStorage under `fg-service-urls` and picked up
 * on next full page load — no rebuild, no code change needed.
 */
export function ServiceSettingsPage() {
  const envSnapshot = useMemo(() => getEnv(), []);
  const [values, setValues] = useState<FormState>(() => buildInitial());
  const [status, setStatus] = useState<null | {
    kind: 'saved' | 'cleared' | 'error';
    message: string;
  }>(null);

  const onChange = (key: ServiceKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const onSave = () => {
    const overrides: Partial<Record<ServiceKey, string>> = {};
    for (const key of SERVICE_KEYS) {
      const v = values[key].trim();
      if (v && !/^https?:\/\//.test(v)) {
        setStatus({
          kind: 'error',
          message: `${SERVICE_LABELS[key]} must start with http:// or https://`,
        });
        return;
      }
      // Only persist when the value differs from the baked env value,
      // so removing an override just falls back to the env-provided URL.
      if (v !== envSnapshot.envValues[key]) {
        overrides[key] = v;
      }
    }
    setServiceOverrides(overrides);
    setStatus({
      kind: 'saved',
      message: 'Saved. Reload the page for the new URLs to take effect.',
    });
  };

  const onReset = () => {
    clearServiceOverrides();
    setValues(buildInitial());
    setStatus({
      kind: 'cleared',
      message: 'Cleared overrides. Reload the page to use env defaults.',
    });
  };

  const onReload = () => {
    window.location.reload();
  };

  return (
    <main className="min-h-screen bg-bg text-t1 px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="font-mono text-[11px] tracking-[0.3em] uppercase text-amber mb-2">
              FAIRGIG
            </div>
            <h1 className="font-serif text-3xl">Service settings</h1>
            <p className="mt-2 max-w-lg font-sans text-sm text-t3">
              Base URLs for each backend service. Edit here to switch to staging
              or local services without changing code. Saved in this browser
              only.
            </p>
          </div>
          <Link
            to="/"
            className="font-mono text-[10px] tracking-widest uppercase text-t3 hover:text-amber"
          >
            ← Back
          </Link>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex flex-col gap-5">
            {SERVICE_KEYS.map((key) => {
              const override = envSnapshot.overrides[key];
              const envValue = envSnapshot.envValues[key];
              const resolved = envSnapshot.resolved[key];
              const configured = resolved.length > 0;
              return (
                <div key={key} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between">
                    <label
                      htmlFor={`svc-${key}`}
                      className="font-mono text-[10px] tracking-widest uppercase text-t3"
                    >
                      {SERVICE_LABELS[key]}
                    </label>
                    <span
                      className={
                        'font-mono text-[9px] tracking-widest uppercase ' +
                        (configured ? 'text-jade' : 'text-rust')
                      }
                    >
                      {configured ? 'Configured' : 'Unavailable'}
                      {override !== undefined ? ' · Override' : ''}
                    </span>
                  </div>
                  <input
                    id={`svc-${key}`}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    spellCheck={false}
                    value={values[key]}
                    onChange={onChange(key)}
                    placeholder="https://…"
                    className="bg-elevated border border-border rounded px-3 py-2 font-mono text-xs text-t1 placeholder:text-t4 focus:outline-none focus:border-amber"
                  />
                  {envValue && envValue !== values[key] && (
                    <span className="font-mono text-[10px] text-t4">
                      Env default: {envValue}
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {status && (
            <div
              role="status"
              className={
                'mt-6 rounded border px-3 py-2 font-mono text-[10px] tracking-widest uppercase ' +
                (status.kind === 'error'
                  ? 'border-rust/40 bg-rust/10 text-rust'
                  : 'border-jade/30 bg-jade/10 text-jade')
              }
            >
              {status.message}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSave}
              className="bg-amber text-bg font-mono text-[11px] tracking-widest uppercase py-2 px-4 rounded hover:opacity-90 transition-opacity"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onReload}
              className="border border-border text-t1 font-mono text-[11px] tracking-widest uppercase py-2 px-4 rounded hover:bg-elevated transition-colors"
            >
              Reload now
            </button>
            <button
              type="button"
              onClick={onReset}
              className="border border-rust/40 text-rust font-mono text-[11px] tracking-widest uppercase py-2 px-4 rounded hover:bg-rust/10 transition-colors"
            >
              Reset to env defaults
            </button>
          </div>
        </div>

        <p className="mt-6 font-sans text-xs text-t4 leading-relaxed">
          Leave a field empty to mark the service as unavailable. The UI will
          gracefully show a "service unavailable" state instead of making calls.
        </p>
      </div>
    </main>
  );
}
