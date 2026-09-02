import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

interface VirtualListProps<T> {
  items: T[];
  height: number;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
  overscan?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  loading?: boolean;
  loadingComponent?: React.ReactNode;
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem,
  className,
  overscan = 5,
  onEndReached,
  endReachedThreshold = 0.8,
  loading = false,
  loadingComponent
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();

  const totalHeight = items.length * itemHeight;
  const containerHeight = height;
  const visibleCount = Math.ceil(containerHeight / itemHeight);

  // Calculate visible range
  const { startIndex, endIndex, visibleItems } = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const end = Math.min(start + visibleCount + overscan, items.length);
    const safeStart = Math.max(0, start - overscan);
    
    return {
      startIndex: safeStart,
      endIndex: end,
      visibleItems: items.slice(safeStart, end)
    };
  }, [scrollTop, itemHeight, visibleCount, overscan, items]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    
    // Handle end reached
    if (onEndReached && !loading) {
      const scrollPercentage = (newScrollTop + containerHeight) / totalHeight;
      if (scrollPercentage >= endReachedThreshold) {
        onEndReached();
      }
    }

    // Track scrolling state for performance
    isScrollingRef.current = true;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isScrollingRef.current = false;
    }, 150);
  }, [onEndReached, loading, containerHeight, totalHeight, endReachedThreshold]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("overflow-auto", className)}
      style={{ height }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${startIndex * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index;
            return (
              <div
                key={actualIndex}
                style={{
                  height: itemHeight,
                  overflow: 'hidden'
                }}
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
          
          {/* Loading indicator */}
          {loading && loadingComponent && (
            <div style={{ height: itemHeight }}>
              {loadingComponent}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Memoized list item wrapper for better performance
export const VirtualListItem = React.memo<{
  children: React.ReactNode;
  className?: string;
}>(({ children, className }) => {
  return (
    <div className={className}>
      {children}
    </div>
  );
});

VirtualListItem.displayName = 'VirtualListItem';

// Hook for virtual list with infinite loading
export const useInfiniteVirtualList = <T,>(
  initialItems: T[],
  loadMore: () => Promise<T[]>,
  hasMore: boolean
) => {
  const [items, setItems] = useState<T[]>(initialItems);
  const [loading, setLoading] = useState(false);

  const handleEndReached = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    try {
      const newItems = await loadMore();
      setItems(prev => [...prev, ...newItems]);
    } catch (error) {
      console.error('Failed to load more items:', error);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, loadMore]);

  return {
    items,
    loading,
    handleEndReached,
    setItems
  };
};