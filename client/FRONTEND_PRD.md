# FairGig Frontend — Complete Setup Guide

---

## 1. Refined Tech Stack

| Layer | Choice | Why locked in |
|-------|--------|---------------|
| Framework | React 19 + Vite + TypeScript | Faster HMR, native ESM, TS catches API contract mismatches early |
| Styling | Tailwind CSS v4 + shadcn/ui | Utility-first + headless accessible primitives |
| Charts | **Recharts** | React-native, composable, same library under Tremor research references |
| Server state | TanStack Query v5 | Caching, background refetch, optimistic updates for shift logging |
| Client state | Zustand + `persist` middleware | Auth tokens, theme preference, no Context re-render storms |
| Network | Axios + single instance | Interceptors for JWT inject + 401 redirect |
| Validation | Zod (forms only — not full schema mirror) | Login, shift form, CSV upload only |
| Routing | React Router v6 | ProtectedRoute wrapper per role |
| Fonts | Fraunces + DM Sans + JetBrains Mono (Google Fonts) | Editorial identity |

---

## 2. Folder Structure

```
src/
├── main.tsx                        # Entry — wrap with providers
├── App.tsx                         # Router + provider composition
│
├── theme/
│   ├── ThemeContext.tsx             # THE single source of truth for dark/light + fonts + tokens
│   ├── tokens.ts                   # All CSS custom properties as JS constants
│   └── GlobalStyles.tsx            # @font-face + CSS variable injection
│
├── api/
│   ├── client.ts                   # Axios instance (base URL, interceptors)
│   ├── auth.ts                     # /api/auth/* calls
│   ├── earnings.ts                 # /api/earnings/* calls
│   ├── anomaly.ts                  # /api/anomaly/* calls
│   ├── grievance.ts                # /api/grievances/* calls
│   ├── analytics.ts                # /api/analytics/* calls
│   └── certificate.ts              # /api/certificate/* calls
│
├── hooks/                          # TanStack Query hooks (consume api/ functions)
│   ├── useAuth.ts
│   ├── useShifts.ts
│   ├── useEarnings.ts
│   ├── useAnomalies.ts
│   ├── useGrievances.ts
│   ├── useAnalytics.ts
│   └── useCertificate.ts
│
├── stores/
│   ├── authStore.ts                # JWT tokens, user info, role — PERSISTED
│   └── uiStore.ts                  # Non-persisted: sidebar open, modal state
│
├── schemas/                        # Zod — ONLY form validation schemas
│   ├── loginSchema.ts
│   ├── shiftSchema.ts
│   └── csvImportSchema.ts
│
├── lib/
│   ├── formatting.ts               # PKR formatting, date formatting
│   ├── math.ts                     # Commission rate calculations
│   └── chartHelpers.ts             # Recharts data transformers
│
├── components/
│   ├── ui/                         # shadcn/ui primitives (auto-generated)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   │
│   └── shared/                     # FairGig-specific reusable components
│       ├── SectionDivider.tsx      # The amber-dot dividers
│       ├── KpiCard.tsx             # The 4-stat cards with countup
│       ├── StatusPill.tsx          # Verified/Pending/Disputed/Unverifiable
│       ├── AnomalyCallout.tsx      # Amber left-border callout box
│       ├── MonoValue.tsx           # JetBrains Mono wrapper for PKR values
│       ├── SerialHeader.tsx        # JetBrains Mono section eyebrow text
│       ├── AppNav.tsx              # Top navigation bar
│       └── ProtectedRoute.tsx      # Role-based route guard
│
├── features/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   └── components/
│   │       └── LoginForm.tsx
│   │
│   ├── worker/
│   │   ├── DashboardPage.tsx       # KPIs + earnings chart + shift table
│   │   ├── ShiftsPage.tsx          # Full shift log with filters
│   │   ├── ShiftLogForm.tsx        # Manual shift entry
│   │   ├── CsvImportPage.tsx
│   │   └── components/
│   │       ├── EarningsTrendChart.tsx
│   │       ├── CommissionBarChart.tsx
│   │       ├── ShiftTable.tsx
│   │       └── ShiftRow.tsx
│   │
│   ├── verifier/
│   │   ├── VerificationQueuePage.tsx
│   │   └── components/
│   │       ├── ScreenshotReview.tsx
│   │       └── VerificationForm.tsx
│   │
│   ├── certificate/
│   │   └── CertificatePage.tsx     # Always renders light — paper document
│   │
│   ├── grievance/
│   │   ├── GrievanceBoardPage.tsx
│   │   └── components/
│   │       ├── GrievanceCard.tsx
│   │       └── GrievanceForm.tsx
│   │
│   └── advocate/
│       ├── AnalyticsDashboardPage.tsx
│       └── components/
│           ├── CommissionTrendsChart.tsx
│           ├── ZoneDistributionChart.tsx
│           └── VulnerabilityFlagsList.tsx
│
└── types/
    ├── api.ts                      # API response shapes (manual, not generated)
    ├── auth.ts
    └── charts.ts
```

---

## 3. Install commands

```bash
# Core
npm create vite@latest fairgig-frontend -- --template react-ts
cd fairgig-frontend

# Styling + components
npm install tailwindcss@latest @tailwindcss/vite
npx shadcn@latest init

# State + data fetching
npm install zustand @tanstack/react-query axios

# Charts
npm install recharts

# Validation + forms
npm install zod react-hook-form @hookform/resolvers

# Routing
npm install react-router-dom

# Font loader (optional — or use @import in CSS)
npm install @fontsource/fraunces @fontsource/dm-sans @fontsource/jetbrains-mono
```

---

## 4. Theme Context — Complete Implementation

This is the single file that controls everything: fonts, colors, dark/light mode, and provides CSS variables to the entire app.

### `src/theme/tokens.ts`
```typescript
// All design tokens as typed constants.
// These are injected as CSS custom properties by ThemeContext.
// Consume via var(--fg-*) in Tailwind or inline styles.

export const DARK_TOKENS = {
  // Backgrounds
  '--fg-bg':        '#0D0D0B',
  '--fg-surface':   '#161614',
  '--fg-elevated':  '#1E1E1B',
  // Borders
  '--fg-border':    '#2A2A27',
  '--fg-border-2':  '#363633',
  // Text
  '--fg-t1': '#F0EBE1',
  '--fg-t2': '#9A9890',
  '--fg-t3': '#5A5A57',
  '--fg-t4': '#3A3A38',
  // Amber — PRIMARY ACCENT (appears only for semantic meaning)
  '--fg-amber':     '#D4900E',
  '--fg-amber-bg':  'rgba(212,144,14,0.09)',
  '--fg-amber-bdr': 'rgba(212,144,14,0.22)',
  // Jade — SUCCESS / VERIFIED
  '--fg-jade':      '#3D8C6E',
  '--fg-jade-bg':   'rgba(61,140,110,0.09)',
  '--fg-jade-bdr':  'rgba(61,140,110,0.26)',
  // Rust — DANGER / DISPUTED / ANOMALY
  '--fg-rust':      '#B83820',
  '--fg-rust-bg':   'rgba(184,56,32,0.09)',
  '--fg-rust-bdr':  'rgba(184,56,32,0.26)',
  // Slate — INFO / UNVERIFIABLE
  '--fg-slate':     '#3A6F96',
  '--fg-slate-bg':  'rgba(58,111,150,0.09)',
  // Fonts
  '--fg-font-serif': "'Fraunces', Georgia, serif",
  '--fg-font-sans':  "'DM Sans', system-ui, sans-serif",
  '--fg-font-mono':  "'JetBrains Mono', monospace",
} as const;

export const LIGHT_TOKENS: typeof DARK_TOKENS = {
  '--fg-bg':        '#F4EFE6',
  '--fg-surface':   '#FFFFFF',
  '--fg-elevated':  '#FAF7F2',
  '--fg-border':    '#DDD5C8',
  '--fg-border-2':  '#C8BEB0',
  '--fg-t1': '#1A1915',
  '--fg-t2': '#6B6762',
  '--fg-t3': '#A09C97',
  '--fg-t4': '#C8C4C0',
  '--fg-amber':     '#B8760A',
  '--fg-amber-bg':  'rgba(184,118,10,0.07)',
  '--fg-amber-bdr': 'rgba(184,118,10,0.22)',
  '--fg-jade':      '#2E7A50',
  '--fg-jade-bg':   'rgba(46,122,80,0.08)',
  '--fg-jade-bdr':  'rgba(46,122,80,0.26)',
  '--fg-rust':      '#A83420',
  '--fg-rust-bg':   'rgba(168,52,32,0.08)',
  '--fg-rust-bdr':  'rgba(168,52,32,0.26)',
  '--fg-slate':     '#2D5F80',
  '--fg-slate-bg':  'rgba(45,95,128,0.08)',
  '--fg-font-serif': "'Fraunces', Georgia, serif",
  '--fg-font-sans':  "'DM Sans', system-ui, sans-serif",
  '--fg-font-mono':  "'JetBrains Mono', monospace",
};

export type ThemeMode = 'dark' | 'light';
export type DesignTokens = typeof DARK_TOKENS;
```

---

### `src/theme/ThemeContext.tsx`
```typescript
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useCallback,
  type ReactNode,
} from 'react';
import { useThemeStore } from '../stores/themeStore';
import { DARK_TOKENS, LIGHT_TOKENS, type ThemeMode, type DesignTokens } from './tokens';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  mode:         ThemeMode;
  tokens:       DesignTokens;
  isDark:       boolean;
  toggle:       () => void;
  setMode:      (mode: ThemeMode) => void;
  // Font helpers — use these instead of hardcoding font-family strings
  fonts: {
    serif: string;
    sans:  string;
    mono:  string;
  };
  // Color helpers — use these in JSX style props
  colors: {
    amber:    string;
    jade:     string;
    rust:     string;
    slate:    string;
    t1:       string;
    t2:       string;
    t3:       string;
    surface:  string;
    border:   string;
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Mode comes from Zustand (persisted to localStorage)
  const mode    = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const tokens = useMemo(
    () => (mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS),
    [mode]
  );

  // Inject all CSS custom properties onto :root
  // useLayoutEffect prevents any flash — runs synchronously before paint
  useLayoutEffect(() => {
    const root = document.documentElement;
    Object.entries(tokens).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    // Also set data-theme for shadcn/ui and any third-party dark-mode detection
    root.setAttribute('data-theme', mode);
    // Set color-scheme for browser UI (scrollbars, inputs, etc.)
    root.style.colorScheme = mode;
  }, [tokens, mode]);

  // Sync system preference on first load if no stored preference
  useEffect(() => {
    const stored = localStorage.getItem('fg-theme-mode');
    if (!stored) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDark ? 'dark' : 'light');
    }
  }, [setMode]);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(() => ({
    mode,
    tokens,
    isDark: mode === 'dark',
    toggle,
    setMode,
    fonts: {
      serif: tokens['--fg-font-serif'],
      sans:  tokens['--fg-font-sans'],
      mono:  tokens['--fg-font-mono'],
    },
    colors: {
      amber:   tokens['--fg-amber'],
      jade:    tokens['--fg-jade'],
      rust:    tokens['--fg-rust'],
      slate:   tokens['--fg-slate'],
      t1:      tokens['--fg-t1'],
      t2:      tokens['--fg-t2'],
      t3:      tokens['--fg-t3'],
      surface: tokens['--fg-surface'],
      border:  tokens['--fg-border'],
    },
  }), [tokens, mode, toggle, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
```

---

## 5. Zustand Stores — Complete Implementation

### Why persisted auth is the right call

React Context for auth means every component wrapped in the provider re-renders when the token refreshes. With 6 microservices and background polling (TanStack Query), that's a lot of unnecessary renders. Zustand's `persist` middleware writes auth state to `localStorage` with zero extra code. The `rehydrated` flag pattern prevents the flash-of-unauthenticated-content bug.

### `src/stores/authStore.ts`
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserRole = 'worker' | 'verifier' | 'advocate';

export interface AuthUser {
  id:            string;
  email:         string;
  displayName:   string;
  role:          UserRole;
  cityZoneId:    string | null;
  cityZoneName:  string | null;
}

interface AuthState {
  user:         AuthUser | null;
  accessToken:  string | null;
  refreshToken: string | null;
  // Guards against flash of unauthenticated content on page load
  // Set to true once Zustand has hydrated from localStorage
  rehydrated:   boolean;

  // Actions
  setAuth:      (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setAccessToken: (token: string) => void;
  clearAuth:    () => void;
  setRehydrated: () => void;
}

// ─── Store ───────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user:         null,
        accessToken:  null,
        refreshToken: null,
        rehydrated:   false,

        setAuth: (user, accessToken, refreshToken) =>
          set({ user, accessToken, refreshToken }, false, 'auth/setAuth'),

        setAccessToken: (token) =>
          set({ accessToken: token }, false, 'auth/refreshToken'),

        clearAuth: () =>
          set(
            { user: null, accessToken: null, refreshToken: null },
            false,
            'auth/logout'
          ),

        setRehydrated: () =>
          set({ rehydrated: true }, false, 'auth/rehydrated'),
      }),
      {
        name: 'fg-auth',                         // localStorage key
        storage: createJSONStorage(() => localStorage),
        // Only persist these fields — never persist transient UI state
        partialize: (state) => ({
          user:         state.user,
          accessToken:  state.accessToken,
          refreshToken: state.refreshToken,
        }),
        // Called after hydration completes — set the rehydrated flag
        onRehydrateStorage: () => (state) => {
          state?.setRehydrated();
        },
      }
    ),
    { name: 'AuthStore' }
  )
);

// ─── Selectors (use these, not the raw store, in components) ─────────────────

export const useIsAuthenticated = () =>
  useAuthStore((s) => !!s.accessToken && !!s.user);

export const useCurrentUser = () =>
  useAuthStore((s) => s.user);

export const useUserRole = () =>
  useAuthStore((s) => s.user?.role ?? null);

export const useAccessToken = () =>
  useAuthStore((s) => s.accessToken);

export const useRehydrated = () =>
  useAuthStore((s) => s.rehydrated);
```

---

### `src/stores/themeStore.ts`
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ThemeMode } from '../theme/tokens';

interface ThemeState {
  mode:    ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark', // default to dark — FairGig's editorial identity

      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'fg-theme',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
```

---

### `src/stores/uiStore.ts`
```typescript
// Non-persisted. Resets on page reload. For transient UI state only.
import { create } from 'zustand';

interface UiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  // Active modal — null means no modal open
  activeModal: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  activeModal: null,
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}));
```

---

## 6. Provider Composition — Main Entry

### `src/main.tsx`
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './theme/ThemeContext';
import App from './App';

// Font imports — loaded globally here, available everywhere via CSS variables
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/400-italic.css';
import '@fontsource/fraunces/600.css';
import '@fontsource/dm-sans/300.css';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';

import './index.css'; // Tailwind directives + base CSS variables

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,     // 2 min — earnings data doesn't change per second
      retry: 1,                      // One retry on failure
      refetchOnWindowFocus: false,   // Don't hammer the API on tab switch
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
```

---

### `src/index.css`
```css
@import "tailwindcss";

/* Font faces are handled by @fontsource imports in main.tsx */

/* Base styles — consume CSS variables from ThemeContext */
:root {
  /* ThemeContext injects all --fg-* variables here at runtime via useLayoutEffect */
  /* These defaults prevent any flash before hydration */
  --fg-bg:       #0D0D0B;
  --fg-surface:  #161614;
  --fg-t1:       #F0EBE1;
  --fg-t2:       #9A9890;
  --fg-t3:       #5A5A57;
  --fg-amber:    #D4900E;
  --fg-jade:     #3D8C6E;
  --fg-rust:     #B83820;
  --fg-font-serif: 'Fraunces', Georgia, serif;
  --fg-font-sans:  'DM Sans', system-ui, sans-serif;
  --fg-font-mono:  'JetBrains Mono', monospace;
}

/* Apply base variables to document */
body {
  background-color: var(--fg-bg);
  color: var(--fg-t1);
  font-family: var(--fg-font-sans);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Serif utility class — use on display headings */
.font-serif { font-family: var(--fg-font-serif) !important; }

/* Mono utility class — use on all PKR values and refs */
.font-mono  { font-family: var(--fg-font-mono) !important; }
```

---

## 7. Tailwind Config

### `tailwind.config.ts`
```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['DM Sans',        'system-ui', 'sans-serif'],
        serif: ['Fraunces',       'Georgia',   'serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // FairGig design tokens — map to CSS variables
        bg:       'var(--fg-bg)',
        surface:  'var(--fg-surface)',
        elevated: 'var(--fg-elevated)',
        border:   { DEFAULT: 'var(--fg-border)', strong: 'var(--fg-border-2)' },
        t1:       'var(--fg-t1)',
        t2:       'var(--fg-t2)',
        t3:       'var(--fg-t3)',
        amber: {
          DEFAULT: 'var(--fg-amber)',
          bg:      'var(--fg-amber-bg)',
          border:  'var(--fg-amber-bdr)',
        },
        jade: {
          DEFAULT: 'var(--fg-jade)',
          bg:      'var(--fg-jade-bg)',
          border:  'var(--fg-jade-bdr)',
        },
        rust: {
          DEFAULT: 'var(--fg-rust)',
          bg:      'var(--fg-rust-bg)',
          border:  'var(--fg-rust-bdr)',
        },
        slate: {
          DEFAULT: 'var(--fg-slate)',
          bg:      'var(--fg-slate-bg)',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

Now in components you can write:
```tsx
// Tailwind classes map directly to design tokens
<div className="bg-surface border border-border rounded-lg p-4">
  <span className="font-mono text-amber">PKR 84,200</span>
  <span className="text-t2 font-sans text-sm">net earned</span>
</div>
```

---

## 8. Axios Client with Auth Interceptors

### `src/api/client.ts`
```typescript
import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';

const BASE_URLS: Record<string, string> = {
  auth:        import.meta.env.VITE_AUTH_URL        ?? 'http://localhost:8001',
  earnings:    import.meta.env.VITE_EARNINGS_URL    ?? 'http://localhost:8002',
  anomaly:     import.meta.env.VITE_ANOMALY_URL     ?? 'http://localhost:8003',
  grievance:   import.meta.env.VITE_GRIEVANCE_URL   ?? 'http://localhost:8004',
  analytics:   import.meta.env.VITE_ANALYTICS_URL   ?? 'http://localhost:8005',
  certificate: import.meta.env.VITE_CERTIFICATE_URL ?? 'http://localhost:8006',
};

function createClient(baseURL: string): AxiosInstance {
  const client = axios.create({
    baseURL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15_000,
  });

  // REQUEST — inject access token from Zustand store
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    // Read directly from store — no React hook needed outside components
    const token = useAuthStore.getState().accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  // RESPONSE — handle 401 (expired token)
  client.interceptors.response.use(
    (response) => response,
    async (error) => {
      const original = error.config;

      if (error.response?.status === 401 && !original._retry) {
        original._retry = true;

        const refreshToken = useAuthStore.getState().refreshToken;

        if (!refreshToken) {
          useAuthStore.getState().clearAuth();
          window.location.replace('/login');
          return Promise.reject(error);
        }

        try {
          // Attempt token refresh
          const { data } = await axios.post(
            `${BASE_URLS.auth}/api/auth/refresh`,
            { refresh_token: refreshToken }
          );

          useAuthStore.getState().setAccessToken(data.access_token);
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return client(original); // Retry original request
        } catch {
          // Refresh failed — force logout
          useAuthStore.getState().clearAuth();
          window.location.replace('/login');
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    }
  );

  return client;
}

// One client per service — uses the correct base URL for each
export const authClient        = createClient(BASE_URLS.auth);
export const earningsClient    = createClient(BASE_URLS.earnings);
export const anomalyClient     = createClient(BASE_URLS.anomaly);
export const grievanceClient   = createClient(BASE_URLS.grievance);
export const analyticsClient   = createClient(BASE_URLS.analytics);
export const certificateClient = createClient(BASE_URLS.certificate);
```

---

## 9. ProtectedRoute + Rehydration Guard

### `src/components/shared/ProtectedRoute.tsx`
```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useIsAuthenticated, useRehydrated, useUserRole } from '../../stores/authStore';
import type { UserRole } from '../../stores/authStore';

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const rehydrated      = useRehydrated();
  const isAuthenticated = useIsAuthenticated();
  const role            = useUserRole();

  // Block render until Zustand has loaded from localStorage
  // Without this: flash of login page then redirect for already-logged-in users
  if (!rehydrated) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--fg-bg)',
        fontFamily: 'var(--fg-font-mono)',
        fontSize: '10px',
        letterSpacing: '0.15em',
        color: 'var(--fg-t4)',
      }}>
        FAIRGIG
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}
```

---

## 10. App.tsx — Route Setup

### `src/App.tsx`
```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { LoginPage }       from './features/auth/LoginPage';
import { RegisterPage }    from './features/auth/RegisterPage';
import { DashboardPage }   from './features/worker/DashboardPage';
import { ShiftsPage }      from './features/worker/ShiftsPage';
import { CertificatePage } from './features/certificate/CertificatePage';
import { VerificationQueuePage } from './features/verifier/VerificationQueuePage';
import { AnalyticsDashboardPage } from './features/advocate/AnalyticsDashboardPage';
import { GrievanceBoardPage } from './features/grievance/GrievanceBoardPage';

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Worker routes */}
      <Route element={<ProtectedRoute allowedRoles={['worker']} />}>
        <Route path="/dashboard"   element={<DashboardPage />} />
        <Route path="/shifts"      element={<ShiftsPage />} />
        <Route path="/certificate" element={<CertificatePage />} />
        <Route path="/grievances"  element={<GrievanceBoardPage />} />
      </Route>

      {/* Verifier routes */}
      <Route element={<ProtectedRoute allowedRoles={['verifier']} />}>
        <Route path="/verify" element={<VerificationQueuePage />} />
      </Route>

      {/* Advocate routes */}
      <Route element={<ProtectedRoute allowedRoles={['advocate']} />}>
        <Route path="/analytics"  element={<AnalyticsDashboardPage />} />
        <Route path="/grievances" element={<GrievanceBoardPage />} />
      </Route>

      {/* Shared grievance board — accessible to both worker and advocate */}
      <Route element={<ProtectedRoute allowedRoles={['worker', 'advocate']} />}>
        <Route path="/community" element={<GrievanceBoardPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/unauthorized" element={<div>Not authorised for this section.</div>} />
    </Routes>
  );
}
```

---

## 11. Using the Theme in Components

```tsx
// Any component — consume fonts and colors from useTheme()
import { useTheme } from '../../theme/ThemeContext';

function KpiCard({ label, value }: { label: string; value: string }) {
  const { fonts, colors } = useTheme();

  return (
    <div style={{
      background: colors.surface,
      border: `0.5px solid ${colors.border}`,
      borderRadius: 8,
      padding: '14px 16px',
    }}>
      <div style={{ fontFamily: fonts.mono, fontSize: 9, color: colors.t3, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: fonts.serif, fontSize: 24, color: colors.t1 }}>
        {value}
      </div>
    </div>
  );
}

// OR use Tailwind classes that map to the same tokens (preferred for less verbosity)
function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      <div className="font-mono text-[9px] tracking-widest uppercase text-t3 mb-2">
        {label}
      </div>
      <div className="font-serif text-2xl text-t1">
        {value}
      </div>
    </div>
  );
}
```

---

## 12. Certificate — Always Renders Light

The certificate is a document, not a screen. It must always use parchment/light styling regardless of the app's dark/light toggle.

```tsx
// src/features/certificate/CertificatePage.tsx
// Intentionally ignores ThemeContext and hardcodes document colors

const CERT_STYLES = {
  background: '#FDFAF5',
  fontFamily: "'DM Sans', system-ui, sans-serif",
  color: '#1A160C',
  // Gold border gradient applied via separate div — see mockup
};

// Wrap the cert container with data-theme="light" to force shadcn/ui
// components inside it to use light mode
<div data-theme="light" style={CERT_STYLES}>
  {/* certificate content */}
</div>
```