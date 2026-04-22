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

// ── Types ─────────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  mode:    ThemeMode;
  tokens:  DesignTokens;
  isDark:  boolean;
  toggle:  () => void;
  setMode: (mode: ThemeMode) => void;
  fonts: {
    serif: string;
    sans:  string;
    mono:  string;
  };
  colors: {
    amber:   string;
    jade:    string;
    rust:    string;
    slate:   string;
    t1:      string;
    t2:      string;
    t3:      string;
    surface: string;
    border:  string;
  };
}

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode    = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const tokens = useMemo(
    () => (mode === 'dark' ? DARK_TOKENS : LIGHT_TOKENS),
    [mode],
  );

  // Inject CSS custom properties onto :root synchronously before paint
  useLayoutEffect(() => {
    const root = document.documentElement;
    (Object.entries(tokens) as [string, string][]).forEach(([prop, val]) => {
      root.style.setProperty(prop, val);
    });
    root.setAttribute('data-theme', mode);
    root.style.colorScheme = mode;
  }, [tokens, mode]);

  // Sync system preference on first load only if Zustand has no persisted value.
  // The store key is 'fg-theme'; check that before overriding with system pref.
  useEffect(() => {
    const stored = localStorage.getItem('fg-theme');
    if (!stored) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setMode(prefersDark ? 'dark' : 'light');
    }
  }, [setMode]);

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo<ThemeContextValue>(
    () => ({
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
    }),
    [tokens, mode, toggle, setMode],
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>');
  return ctx;
}
