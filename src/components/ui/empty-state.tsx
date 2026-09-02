import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className,
}) => {
  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className="flex flex-col items-center justify-center py-16 px-6">
        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
          <Icon className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground text-center mb-6 max-w-md">
          {description}
        </p>
        {action && (
          <Button onClick={action.onClick} className="btn-gradient">
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
};