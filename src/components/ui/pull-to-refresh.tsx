import React, { useState, useRef, useCallback, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  className?: string;
  refreshThreshold?: number;
  disabled?: boolean;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  className,
  refreshThreshold = 80,
  disabled = false
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [canPull, setCanPull] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;

    // Only allow pull if we're at the top of the scroll
    const isAtTop = container.scrollTop === 0;
    setCanPull(isAtTop);
    
    if (isAtTop) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDraggingRef.current || !canPull || disabled || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const deltaY = currentY - startYRef.current;
    
    if (deltaY > 0) {
      // Apply resistance as we pull further
      const resistance = Math.max(0.3, 1 - (deltaY / 300));
      const adjustedDelta = deltaY * resistance;
      setPullDistance(Math.min(adjustedDelta, refreshThreshold * 1.5));
      
      // Prevent default scrolling when pulling
      e.preventDefault();
    }
  }, [canPull, disabled, isRefreshing, refreshThreshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current || disabled || isRefreshing) return;

    isDraggingRef.current = false;
    
    if (pullDistance >= refreshThreshold) {
      setIsRefreshing(true);
      setPullDistance(refreshThreshold);
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
        setCanPull(false);
      }
    } else {
      setPullDistance(0);
      setCanPull(false);
    }
  }, [pullDistance, refreshThreshold, onRefresh, disabled, isRefreshing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const pullProgress = Math.min(pullDistance / refreshThreshold, 1);
  const shouldTrigger = pullDistance >= refreshThreshold;

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
      style={{ touchAction: 'pan-y' }}
    >
      {/* Pull to refresh indicator */}
      <div
        className={cn(
          "absolute top-0 left-0 right-0 flex items-center justify-center transition-all duration-200 ease-out z-10",
          "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b",
          pullDistance > 0 ? "opacity-100" : "opacity-0"
        )}
        style={{
          height: `${Math.max(pullDistance, 0)}px`,
          transform: `translateY(-${Math.max(0, refreshThreshold - pullDistance)}px)`
        }}
      >
        <div className="flex flex-col items-center gap-2 text-sm">
          <div className="relative">
            <RefreshCw 
              className={cn(
                "h-6 w-6 transition-all duration-200",
                isRefreshing ? "animate-spin text-primary" : "text-muted-foreground",
                shouldTrigger && !isRefreshing ? "text-primary scale-110" : ""
              )}
              style={{
                transform: `rotate(${pullProgress * 180}deg)`
              }}
            />
            
            {/* Progress ring */}
            <svg 
              className="absolute inset-0 h-6 w-6 -rotate-90" 
              viewBox="0 0 24 24"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="opacity-20"
              />
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className={cn(
                  "transition-all duration-200",
                  shouldTrigger ? "stroke-primary" : "stroke-muted-foreground"
                )}
                style={{
                  strokeDasharray: `${2 * Math.PI * 10}`,
                  strokeDashoffset: `${2 * Math.PI * 10 * (1 - pullProgress)}`
                }}
              />
            </svg>
          </div>
          
          <span className={cn(
            "text-xs font-medium transition-colors duration-200",
            isRefreshing ? "text-primary" : 
            shouldTrigger ? "text-primary" : "text-muted-foreground"
          )}>
            {isRefreshing ? "Refreshing..." : 
             shouldTrigger ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        className="transition-transform duration-200 ease-out"
        style={{
          transform: `translateY(${pullDistance}px)`
        }}
      >
        {children}
      </div>
    </div>
  );
};

// Hook for managing pull to refresh state
export const usePullToRefresh = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refresh = useCallback(async (refreshFn: () => Promise<void>) => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    try {
      await refreshFn();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing]);

  return {
    isRefreshing,
    refresh
  };
};