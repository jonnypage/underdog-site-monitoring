'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

const LOGO_SRC = '/org/UILogo.webp';

type OrgLogoProps = {
  /** Larger logo in the desktop sidebar */
  variant?: 'sidebar' | 'header';
  className?: string;
  /** Runs after navigation (e.g. close a mobile drawer). */
  onNavigate?: () => void;
};

export function OrgLogo({ variant = 'sidebar', className, onNavigate }: OrgLogoProps) {
  return (
    <Link
      href='/sites'
      onClick={onNavigate}
      className={cn(
        'inline-flex shrink-0 items-center rounded-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <Image
        src={LOGO_SRC}
        alt='Organization'
        width={200}
        height={80}
        className={cn(
          'w-auto object-contain object-left',
          variant === 'sidebar' ? 'h-13 max-w-[200px]' : 'h-8 max-w-[200px]',
        )}
        priority
      />
    </Link>
  );
}
