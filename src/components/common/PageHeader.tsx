import React from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Rendered opposite the title (e.g. a primary action button). */
  action?: React.ReactNode;
  className?: string;
}

/** Shared page header: H1 + optional subtitle, with an optional action slot. */
const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, action, className }) => (
  <div className={cn('flex flex-col md:flex-row md:items-center md:justify-between gap-4', className)}>
    <div>
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export default PageHeader;
