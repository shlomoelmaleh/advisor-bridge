import React from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Usually a lucide icon, e.g. <MessageCircle className="h-12 w-12" /> */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Shared empty-state block for lists/tabs with no content. */
const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, className }) => (
  <div className={cn('flex flex-col items-center justify-center text-center py-10', className)}>
    {icon && <div className="mb-4 text-muted-foreground opacity-30">{icon}</div>}
    <h3 className="font-semibold text-foreground">{title}</h3>
    {description && (
      <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">{description}</p>
    )}
    {action && <div className="mt-4">{action}</div>}
  </div>
);

export default EmptyState;
