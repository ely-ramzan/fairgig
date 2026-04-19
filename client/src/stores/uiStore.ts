// Non-persisted — resets on page reload. For transient UI state only.
import { create } from 'zustand';

export type ToastVariant = 'default' | 'success' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface UiState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;

  activeModal: string | null;
  openModal: (id: string) => void;
  closeModal: () => void;

  toasts: ToastItem[];
  pushToast: (message: string, variant?: ToastVariant) => void;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiState>()((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

  activeModal: null,
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),

  toasts: [],
  pushToast: (message, variant = 'default') =>
    set((s) => ({
      toasts: [
        ...s.toasts,
        {
          id:
            typeof crypto !== 'undefined' && 'randomUUID' in crypto
              ? crypto.randomUUID()
              : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          message,
          variant,
        },
      ],
    })),
  dismissToast: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),
}));

export function useToast() {
  const pushToast = useUiStore((s) => s.pushToast);
  const dismissToast = useUiStore((s) => s.dismissToast);
  return { toast: pushToast, dismiss: dismissToast };
}
