'use client';

import type { ComponentProps, ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Ghost destructive hover (used by icon dismiss control). */
export const dangerGhostButtonClassName =
  'hover:bg-destructive hover:text-destructive-foreground';

/** Filled destructive: red label on light red fill; hover uses solid red + high-contrast label. */
export const dangerFilledButtonClassName = cn(
  'border border-destructive/40 bg-destructive/15 text-destructive shadow-sm',
  'transition-[background-color,box-shadow,border-color,color]',
  'hover:border-destructive hover:bg-destructive hover:text-destructive-foreground hover:shadow-md',
  'focus-visible:ring-2 focus-visible:ring-destructive focus-visible:ring-offset-2 focus-visible:ring-offset-background',
);

/** Compact icon trigger (e.g. dismiss) with the same destructive hover as text actions. */
export const dangerIconTriggerClassName = cn(
  'shrink-0 !h-8 !w-8 !min-h-0 rounded-full p-1.5 text-muted-foreground transition-colors',
  dangerGhostButtonClassName,
);

export type DestructiveCatalogIntent = 'delete' | 'remove';

/** Titles and confirm button copy for catalog-style delete/remove dialogs. */
export function destructiveCatalogDialogLabels(
  resourceNoun: string,
  intent: DestructiveCatalogIntent,
): { title: string; confirmLabel: string; pendingLabel: string } {
  if (intent === 'delete') {
    return {
      title: `Delete ${resourceNoun}`,
      confirmLabel: 'Delete',
      pendingLabel: 'Deleting…',
    };
  }
  return {
    title: `Remove ${resourceNoun}`,
    confirmLabel: 'Remove',
    pendingLabel: 'Removing…',
  };
}

/** Rotate API key confirmation (devices list, install wizard). */
export function rotateApiKeyDialogLabels(): {
  title: string;
  confirmLabel: string;
  pendingLabel: string;
} {
  return {
    title: 'Rotate API key',
    confirmLabel: 'Rotate key',
    pendingLabel: 'Rotating…',
  };
}

export function deleteDeviceConfirmDescription(deviceName: string): ReactNode {
  return (
    <p>
      Are you sure you want to delete the device <strong>{deviceName}</strong>?
      Past measurements will stay in the database, but the device can no longer
      post.
    </p>
  );
}

export function removeSensorFromCatalogDescription(
  sensorKey: string,
): ReactNode {
  return (
    <p>
      Remove sensor{' '}
      <strong className='font-mono text-foreground'>{sensorKey}</strong> from
      the catalog? It will disappear from dashboards and site settings.
      Historical measurements that used this key may still exist in the
      database.
    </p>
  );
}

export function rotateApiKeyConfirmDescription(
  deviceDisplayName: string,
): ReactNode {
  return (
    <p>
      Are you sure you want to rotate the API key for{' '}
      <strong>{deviceDisplayName}</strong>? The previous key will stop working
      immediately and the device will need to be reflashed.
    </p>
  );
}

type DangerActionButtonProps = Omit<ButtonProps, 'variant'> & {
  /** Sets default label when `children` is omitted. */
  intent: DestructiveCatalogIntent;
};

/** Table / toolbar action for delete / remove-from-catalog: red by default, more prominent on hover. */
export function DangerActionButton({
  intent,
  children,
  className,
  size = 'sm',
  ...props
}: DangerActionButtonProps) {
  const label = intent === 'delete' ? 'Delete' : 'Remove';
  return (
    <Button
      type='button'
      variant='default'
      size={size}
      className={cn(dangerFilledButtonClassName, className)}
      {...props}
    >
      {children ?? label}
    </Button>
  );
}

type DangerIconButtonProps = Omit<ComponentProps<typeof Button>, 'variant'> & {
  /** Accessible name; default is for dismissing an alert. */
  'aria-label'?: string;
};

/** Icon-only destructive control (e.g. dismiss alert). */
export function DangerIconButton({
  'aria-label': ariaLabel = 'Dismiss alert',
  className,
  children,
  size = 'icon',
  ...props
}: DangerIconButtonProps) {
  return (
    <Button
      type='button'
      variant='ghost'
      size={size}
      aria-label={ariaLabel}
      className={cn(dangerIconTriggerClassName, className)}
      {...props}
    >
      {children}
    </Button>
  );
}
