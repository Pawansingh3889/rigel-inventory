import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  /** Icon shown above the title. Defaults to a generic inbox. */
  icon?: LucideIcon;
  title: string;
  /** One line explaining why this is empty, or what to do next. */
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Use when the emptiness is the result of a filter or search, not no data. */
  variant?: 'default' | 'search';
  className?: string;
}

/**
 * The single empty state for lists, tables and panels. Replaces the ad-hoc
 * "No X found" paragraphs so every surface reads the same way.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variant = 'default',
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center px-6',
        variant === 'search' ? 'py-8' : 'py-12',
        className
      )}
    >
      <div className="rounded-full bg-muted p-3 mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} size="sm" className="mt-4">
          {action.label}
        </Button>
      )}
    </div>
  );
};
