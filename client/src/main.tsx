import { StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { loadRuntimeConfig } from './config/runtimeConfig';

// Font imports — loaded globally, available everywhere via CSS variables.
// Run: npm install @fontsource/fraunces @fontsource/dm-sans @fontsource/jetbrains-mono
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/dm-sans/300.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './index.css';

/**
 * Boot order:
 *   1. Load runtime config (/api/config → /config.json → empty).
 *   2. Dynamically import the app shell so every module that calls `getEnv()`
 *      at load time (api/client.ts, stores, hooks) sees the resolved URLs.
 *   3. Render.
 *
 * loadRuntimeConfig() has its own timeout/fallback — it never throws and
 * never blocks for more than a few seconds.
 */

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

const root: Root = createRoot(rootEl);

function renderBootScreen(): void {
  root.render(
    <div
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0b0b',
        color: '#9a8c5c',
        fontFamily: 'monospace',
        fontSize: 11,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
      }}
    >
      FAIRGIG
    </div>,
  );
}

async function bootstrap() {
  renderBootScreen();

  // Best-effort; never throws.
  try {
    await loadRuntimeConfig();
  } catch (err) {
    console.warn('[FairGig] runtime config unavailable, using VITE_* defaults', err);
  }

  // Dynamic imports so every module below sees the resolved env.
  const [
    { BrowserRouter },
    { QueryClientProvider },
    { queryClient },
    { ThemeProvider },
    { ErrorBoundary },
    { Toaster },
    { OfflineBanner },
    { AuthNavigationBridge },
    AppModule,
  ] = await Promise.all([
    import('react-router-dom'),
    import('@tanstack/react-query'),
    import('./lib/queryClient'),
    import('./theme/ThemeContext'),
    import('./components/shared/ErrorBoundary'),
    import('./components/shared/Toaster'),
    import('./components/shared/OfflineBanner'),
    import('./components/shared/AuthNavigationBridge'),
    import('./App'),
  ]);

  const App = AppModule.default;

  root.render(
    <StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <OfflineBanner />
              <AuthNavigationBridge />
              <App />
              <Toaster />
            </ThemeProvider>
          </QueryClientProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </StrictMode>,
  );
}

bootstrap().catch((err) => {
  console.error('[FairGig] bootstrap failed', err);
  root.render(
    <div style={{ padding: 24, fontFamily: 'monospace', color: '#c44' }}>
      <h1>FairGig failed to start</h1>
      <pre>{String((err as Error)?.message ?? err)}</pre>
      <p>Try reloading. If this persists, check /api/config or /config.json.</p>
    </div>,
  );
});
