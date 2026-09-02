import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

// Card skeleton for mobile list items
export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("animate-pulse", className)}>
      <div className="bg-card rounded-lg border p-4 space-y-3">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
        
        {/* Content */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-1">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
};

// Table skeleton for desktop views
export const TableSkeleton: React.FC<{ 
  rows?: number; 
  columns?: number;
  className?: string;
}> = ({ 
  rows = 5, 
  columns = 6,
  className 
}) => {
  return (
    <div className={cn("space-y-3", className)}>
      {/* Table header */}
      <div className="flex space-x-4 p-4 border-b">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      
      {/* Table rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex space-x-4 p-4">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
};

// Stats card skeleton
export const StatsSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-card rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-4" />
          </div>
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
};

// Form skeleton
export const FormSkeleton: React.FC<{ 
  fields?: number;
  className?: string;
}> = ({ 
  fields = 6,
  className 
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: fields }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      
      {/* Action buttons */}
      <div className="flex gap-2 pt-4">
        <Skeleton className="h-10 w-20" />
        <Skeleton className="h-10 w-16" />
      </div>
    </div>
  );
};

// Search and filter skeleton
export const SearchFilterSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Search bar */}
      <Skeleton className="h-10 w-full" />
      
      {/* Filter buttons */}
      <div className="flex gap-2 overflow-x-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 flex-shrink-0" />
        ))}
      </div>
    </div>
  );
};

// Loading state component that wraps content
export const LoadingWrapper: React.FC<{
  loading: boolean;
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ loading, skeleton, children, className }) => {
  if (loading) {
    return <div className={className}>{skeleton}</div>;
  }
  
  return <>{children}</>;
};

// Hook for managing loading states with skeletons
export const useLoadingState = (initialLoading = false) => {
  const [loading, setLoading] = React.useState(initialLoading);
  
  const withLoading = React.useCallback(async (fn: () => Promise<void>) => {
    setLoading(true);
    try {
      await fn();
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    setLoading,
    withLoading
  };
};