import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SpinnerProps = {
  className?: string;
  /** Icon size: xs for inline table rows, sm default, md for large placeholders */
  size?: 'xs' | 'sm' | 'md';
};

export function Spinner({ className, size = 'sm' }: SpinnerProps) {
  return (
    <Loader2
      className={cn(
        'shrink-0 animate-spin text-primary',
        size === 'xs' && 'h-3.5 w-3.5',
        size === 'sm' && 'h-4 w-4',
        size === 'md' && 'h-5 w-5',
        className,
      )}
      aria-hidden
    />
  );
}

type LoadingMessageProps = {
  children: ReactNode;
  className?: string;
};

/** Muted loading line with spinner in front (paragraph). */
export function LoadingMessage({ children, className }: LoadingMessageProps) {
  return (
    <p
      role="status"
      className={cn(
        'flex items-center gap-2 text-sm text-muted-foreground',
        className,
      )}
    >
      <Spinner />
      {children}
    </p>
  );
}
