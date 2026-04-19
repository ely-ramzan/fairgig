import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './theme/ThemeContext';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { Toaster } from './components/shared/Toaster';
import { OfflineBanner } from './components/shared/OfflineBanner';
import { getEnv } from './config/env';
import App from './App';
import { AuthNavigationBridge } from './components/shared/AuthNavigationBridge';

try {
  getEnv();
} catch (e) {
  console.error('[FairGig] Invalid environment', e);
}

// Font imports — loaded globally, available everywhere via CSS variables
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

createRoot(document.getElementById('root')!).render(
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
