import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Edit, Trash2, Eye, MoreHorizontal } from 'lucide-react';

interface SwipeAction {
  id: string;
  label: string;
  icon: React.ElementType;
  variant?: 'default' | 'destructive' | 'secondary';
  onClick: () => void;
}

interface SwipeActionsProps {
  actions: SwipeAction[];
  children: React.ReactNode;
  className?: string;
  threshold?: number;
  disabled?: boolean;
}

export const SwipeActions: React.FC<SwipeActionsProps> = ({
  actions,
  children,
  className,
  threshold = 80,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return;
    
    const touch = e.touches[0];
    startXRef.current = touch.clientX;
    currentXRef.current = touch.clientX;
    setIsDragging(true);
  }, [disabled]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging || disabled) return;

    const touch = e.touches[0];
    const deltaX = startXRef.current - touch.clientX;
    
    // Only allow left swipe (positive deltaX)
    if (deltaX > 0) {
      setDragOffset(Math.min(deltaX, 120)); // Max 120px
      e.preventDefault();
    }
  }, [isDragging, disabled]);

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || disabled) return;

    setIsDragging(false);
    
    if (dragOffset > threshold) {
      setIsOpen(true);
      setDragOffset(120);
    } else {
      setIsOpen(false);
      setDragOffset(0);
    }
  }, [isDragging, dragOffset, threshold, disabled]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (disabled) return;
    
    startXRef.current = e.clientX;
    currentXRef.current = e.clientX;
    setIsDragging(true);
    
    // Prevent text selection
    e.preventDefault();
  }, [disabled]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || disabled) return;

    const deltaX = startXRef.current - e.clientX;
    
    if (deltaX > 0) {
      setDragOffset(Math.min(deltaX, 120));
    }
  }, [isDragging, disabled]);

  const handleMouseUp = useCallback(() => {
    if (!isDragging || disabled) return;

    setIsDragging(false);
    
    if (dragOffset > threshold) {
      setIsOpen(true);
      setDragOffset(120);
    } else {
      setIsOpen(false);
      setDragOffset(0);
    }
  }, [isDragging, dragOffset, threshold, disabled]);

  // Close swipe when clicking outside
  const handleClickOutside = useCallback((e: Event) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
      setDragOffset(0);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Touch events
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    // Mouse events for desktop testing
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Click outside to close
    document.addEventListener('click', handleClickOutside);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseMove, handleMouseUp, handleClickOutside]);

  const closeSwipe = useCallback(() => {
    setIsOpen(false);
    setDragOffset(0);
  }, []);

  const handleActionClick = useCallback((action: SwipeAction) => {
    action.onClick();
    closeSwipe();
  }, [closeSwipe]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative overflow-hidden touch-pan-y select-none",
        className
      )}
    >
      {/* Main Content */}
      <div
        className={cn(
          "transition-transform duration-200 ease-out relative z-10",
          isDragging ? "transition-none" : ""
        )}
        style={{
          transform: `translateX(-${dragOffset}px)`
        }}
      >
        {children}
      </div>

      {/* Action Buttons */}
      <div 
        className="absolute inset-y-0 right-0 flex items-center"
        style={{ width: `${Math.max(dragOffset, isOpen ? 120 : 0)}px` }}
      >
        <div className="flex h-full">
          {actions.map((action, index) => {
            const buttonWidth = 120 / actions.length;
            return (
              <Button
                key={action.id}
                variant={action.variant || 'default'}
                size="sm"
                className={cn(
                  "h-full rounded-none border-0 flex flex-col items-center justify-center gap-1 text-xs",
                  action.variant === 'destructive' && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                  "opacity-0 animate-fade-in",
                  dragOffset > (index + 1) * (threshold / actions.length) && "opacity-100"
                )}
                style={{ 
                  width: `${buttonWidth}px`,
                  animationDelay: `${index * 50}ms`
                }}
                onClick={() => handleActionClick(action)}
              >
                <action.icon className="h-4 w-4" />
                <span className="text-xs">{action.label}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Swipe Hint Indicator */}
      {!disabled && !isOpen && (
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 opacity-30">
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </div>
  );
};

// Common action presets
export const createSwipeActions = {
  view: (onView: () => void): SwipeAction => ({
    id: 'view',
    label: 'View',
    icon: Eye,
    variant: 'secondary',
    onClick: onView
  }),
  
  edit: (onEdit: () => void): SwipeAction => ({
    id: 'edit',
    label: 'Edit',
    icon: Edit,
    variant: 'default',
    onClick: onEdit
  }),
  
  delete: (onDelete: () => void): SwipeAction => ({
    id: 'delete',
    label: 'Delete',
    icon: Trash2,
    variant: 'destructive',
    onClick: onDelete
  })
};

// Hook for managing swipe actions state
export const useSwipeActions = (items: any[]) => {
  const [openItemId, setOpenItemId] = useState<string | null>(null);

  const closeAll = useCallback(() => {
    setOpenItemId(null);
  }, []);

  const isOpen = useCallback((itemId: string) => {
    return openItemId === itemId;
  }, [openItemId]);

  const toggle = useCallback((itemId: string) => {
    setOpenItemId(prev => prev === itemId ? null : itemId);
  }, []);

  return {
    openItemId,
    closeAll,
    isOpen,
    toggle
  };
};