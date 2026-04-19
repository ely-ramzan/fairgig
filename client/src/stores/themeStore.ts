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
      mode: 'dark', // default — FairGig's editorial identity

      setMode: (mode) => set({ mode }),
    }),
    {
      name:    'fg-theme',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
