import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SwipeActions, createSwipeActions } from './swipe-actions';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, MoreVertical } from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';

interface CardAction {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'secondary';
}

interface EnhancedCardProps {
  title: string;
  subtitle?: string;
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  };
  icon?: React.ElementType;
  actions?: CardAction[];
  swipeActions?: CardAction[];
  expandable?: boolean;
  defaultExpanded?: boolean;
  onExpand?: (expanded: boolean) => void;
  children?: React.ReactNode;
  className?: string;
  interactive?: boolean;
  onClick?: () => void;
}

export const EnhancedCard: React.FC<EnhancedCardProps> = ({
  title,
  subtitle,
  badge,
  icon: Icon,
  actions = [],
  swipeActions = [],
  expandable = false,
  defaultExpanded = false,
  onExpand,
  children,
  className,
  interactive = false,
  onClick
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleExpand = useCallback((expanded: boolean) => {
    setIsExpanded(expanded);
    onExpand?.(expanded);
  }, [onExpand]);

  const handleCardClick = useCallback(() => {
    if (expandable) {
      handleExpand(!isExpanded);
    }
    onClick?.();
  }, [expandable, isExpanded, handleExpand, onClick]);

  const cardContent = (
    <Card className={cn(
      "transition-all duration-200",
      interactive && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
      className
    )}>
      <div onClick={expandable || onClick ? handleCardClick : undefined}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              {Icon && (
                <div className="p-2 rounded-lg bg-primary/10 text-primary flex-shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-base truncate">{title}</h3>
                  {badge && (
                    <Badge variant={badge.variant || 'default'} className="text-xs">
                      {badge.text}
                    </Badge>
                  )}
                </div>
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Desktop Actions */}
              {actions.length > 0 && (
                <div className="hidden sm:flex gap-1">
                  {actions.slice(0, 2).map((action) => (
                    <Button
                      key={action.id}
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        action.onClick();
                      }}
                      className="h-8 w-8 p-0"
                    >
                      <action.icon className="h-4 w-4" />
                    </Button>
                  ))}
                  {actions.length > 2 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {actions.slice(2).map((action) => (
                          <DropdownMenuItem
                            key={action.id}
                            onClick={action.onClick}
                            className="flex items-center gap-2"
                          >
                            <action.icon className="h-4 w-4" />
                            {action.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              )}
              
              {/* Expand/Collapse Indicator */}
              {expandable && (
                <div className="flex items-center">
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
      </div>

      {/* Expandable Content */}
      {expandable ? (
        <Collapsible open={isExpanded} onOpenChange={handleExpand}>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {children}
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      ) : (
        children && (
          <CardContent className="pt-0">
            {children}
          </CardContent>
        )
      )}
    </Card>
  );

  // Wrap with swipe actions if provided (mobile only)
  if (swipeActions.length > 0) {
    const swipeActionsList = swipeActions.map(action => ({
      id: action.id,
      label: action.label,
      icon: action.icon,
      variant: action.variant || 'default',
      onClick: action.onClick
    }));

    return (
      <div className="sm:hidden">
        <SwipeActions actions={swipeActionsList}>
          {cardContent}
        </SwipeActions>
      </div>
    );
  }

  return cardContent;
};

// Enhanced Card List component for consistent spacing and animations
interface EnhancedCardListProps {
  children: React.ReactNode;
  className?: string;
  staggered?: boolean;
}

export const EnhancedCardList: React.FC<EnhancedCardListProps> = ({
  children,
  className,
  staggered = false
}) => {
  return (
    <div className={cn(
      "space-y-3",
      staggered && "stagger-animation",
      className
    )}>
      {children}
    </div>
  );
};

// Hook for managing enhanced card states
export const useEnhancedCards = <T extends { id: string }>(items: T[]) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const toggleExpanded = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleSelected = useCallback((id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isExpanded = useCallback((id: string) => expandedItems.has(id), [expandedItems]);
  const isSelected = useCallback((id: string) => selectedItems.has(id), [selectedItems]);

  const expandAll = useCallback(() => {
    setExpandedItems(new Set(items.map(item => item.id)));
  }, [items]);

  const collapseAll = useCallback(() => {
    setExpandedItems(new Set());
  }, []);

  const selectAll = useCallback(() => {
    setSelectedItems(new Set(items.map(item => item.id)));
  }, [items]);

  const clearSelection = useCallback(() => {
    setSelectedItems(new Set());
  }, []);

  return {
    expandedItems,
    selectedItems,
    toggleExpanded,
    toggleSelected,
    isExpanded,
    isSelected,
    expandAll,
    collapseAll,
    selectAll,
    clearSelection
  };
};