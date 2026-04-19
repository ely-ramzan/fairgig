import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 px-4 text-center border border-dashed border-border rounded-sm bg-surface/50">
      <p className="font-mono text-[10px] tracking-widest uppercase text-t3">{title}</p>
      {description && <p className="font-sans text-sm text-t2 max-w-md">{description}</p>}
      {action}
    </div>
  );
}
