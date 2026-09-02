import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  variant?: 'default' | 'primary' | 'secondary' | 'accent';
  className?: string;
}

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className,
}) => {
  const variantStyles = {
    default: 'bg-card',
    primary: 'bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20',
    secondary: 'bg-gradient-to-br from-secondary/5 to-secondary/10 border-secondary/20',
    accent: 'bg-gradient-to-br from-accent/5 to-accent/10 border-accent/20',
  };

  const iconStyles = {
    default: 'text-muted-foreground',
    primary: 'text-primary',
    secondary: 'text-secondary',
    accent: 'text-accent',
  };

  return (
    <Card className={cn(
      'card-interactive shadow-card hover:shadow-elevated transition-all duration-300',
      variantStyles[variant],
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <div className="space-y-1">
              <p className="text-3xl font-bold tracking-tight">{value}</p>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {trend && (
              <div className="flex items-center gap-2">
                <Badge 
                  variant={trend.isPositive ? "default" : "destructive"}
                  className="text-xs"
                >
                  {trend.isPositive ? '+' : ''}{trend.value}%
                </Badge>
                <span className="text-xs text-muted-foreground">{trend.label}</span>
              </div>
            )}
          </div>
          <div className={cn(
            'p-3 rounded-xl bg-background/50',
            iconStyles[variant]
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};