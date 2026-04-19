// Wraps PKR values and any monospace reference numbers in JetBrains Mono.
import type { ReactNode } from 'react';

interface MonoValueProps {
  children: ReactNode;
  size?:    'sm' | 'base' | 'lg' | 'xl' | '2xl';
  muted?:   boolean;
}

const SIZE_CLASS: Record<string, string> = {
  sm:   'text-sm',
  base: 'text-base',
  lg:   'text-lg',
  xl:   'text-xl',
  '2xl': 'text-2xl',
};

export function MonoValue({ children, size = 'base', muted = false }: MonoValueProps) {
  return (
    <span className={`font-mono ${SIZE_CLASS[size]} ${muted ? 'text-t2' : 'text-t1'}`}>
      {children}
    </span>
  );
}
