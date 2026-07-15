import React from 'react';
import { cn } from '@/lib/utils';

// Brand colors are literal here (not CSS tokens) so the mark stays identical
// wherever it renders — including contexts without the app stylesheet.
const NAVY = '#1B2A4A';
const TEAL = '#059467';

/**
 * BranchMatch logomark: two overlapping rounded squares — the bank side (teal,
 * back) and the advisor side (navy, front) meeting, with a plus where they
 * connect. Keep in sync with public/favicon.svg.
 *
 * scheme="onDark" inverts the front square to white (navy plus) for navy
 * backgrounds (landing hero navbar, footer), where the navy square would sink.
 */
export const LogoMark: React.FC<{
  size?: number;
  className?: string;
  scheme?: 'default' | 'onDark';
}> = ({ size = 32, className, scheme = 'default' }) => {
  const front = scheme === 'onDark' ? '#FFFFFF' : NAVY;
  const plus = scheme === 'onDark' ? NAVY : '#FFFFFF';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="BranchMatch"
    >
      <rect x="9" y="2" width="21" height="21" rx="6" fill={TEAL} />
      <rect x="2" y="9" width="21" height="21" rx="6" fill={front} />
      <rect x="7.5" y="18" width="10" height="3" rx="1.5" fill={plus} />
      <rect x="11" y="14.5" width="3" height="10" rx="1.5" fill={plus} />
    </svg>
  );
};

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  className?: string;
  /** Extra classes for the wordmark span only (e.g. responsive hiding). */
  wordmarkClassName?: string;
}

const Logo: React.FC<LogoProps> = ({ size = 32, withWordmark = false, className, wordmarkClassName }) => (
  <span className={cn('inline-flex items-center gap-2', className)}>
    <LogoMark size={size} />
    {withWordmark && (
      <span className={cn('font-bold text-lg text-foreground', wordmarkClassName)}>
        BranchMatch&#x200F;
      </span>
    )}
  </span>
);

export default Logo;
