import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useIsMobile } from '@/hooks/use-mobile';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  ChevronDown, 
  RefreshCw,
  Menu
} from 'lucide-react';

interface QuickAction {
  id: string;
  label: string;
  icon: React.ElementType;
  variant?: 'default' | 'outline' | 'destructive';
  onClick: () => void;
}

interface FilterOption {
  id: string;
  label: string;
  value: any;
}

interface StatCard {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'destructive';
  icon?: React.ElementType;
}

interface MobileOptimizedModuleProps {
  title: string;
  subtitle?: string;
  quickActions?: QuickAction[];
  statsCards?: StatCard[];
  filterOptions?: FilterOption[];
  searchPlaceholder?: string;
  onSearch?: (term: string) => void;
  onFilter?: (filters: Record<string, any>) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const MobileOptimizedModule: React.FC<MobileOptimizedModuleProps> = ({
  title,
  subtitle,
  quickActions = [],
  statsCards = [],
  filterOptions = [],
  searchPlaceholder = 'Search...',
  onSearch,
  onFilter,
  onRefresh,
  refreshing = false,
  children,
  className
}) => {
  const isMobile = useIsMobile();
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Record<string, any>>({});

  const handleSearch = useCallback((term: string) => {
    setSearchTerm(term);
    onSearch?.(term);
  }, [onSearch]);

  const handleFilterChange = useCallback((filterId: string, value: any) => {
    const newFilters = { ...activeFilters, [filterId]: value };
    setActiveFilters(newFilters);
    onFilter?.(newFilters);
  }, [activeFilters, onFilter]);

  const clearFilters = useCallback(() => {
    setActiveFilters({});
    onFilter?.({});
  }, [onFilter]);

  const activeFilterCount = useMemo(() => 
    Object.values(activeFilters).filter(Boolean).length, 
    [activeFilters]
  );

  const StatCard = React.memo<{ stat: StatCard }>(({ stat }) => (
    <Card className="card-interactive">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {stat.title}
          </CardTitle>
          {stat.icon && (
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-2xl font-bold">{stat.value}</div>
        {stat.subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
        )}
      </CardContent>
    </Card>
  ));

  if (!isMobile) {
    // Desktop layout - return children as-is with minimal wrapper
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  return (
    <div className={`mobile-spacing space-y-4 ${className}`}>
      {/* Mobile Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">{title}</h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground">{subtitle}</p>
              )}
            </div>
            
            {onRefresh && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={refreshing}
                className="h-8 w-8 p-0"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              </Button>
            )}
          </div>

          {/* Search Bar */}
          {onSearch && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 pr-4"
              />
            </div>
          )}

          {/* Quick Actions Row */}
          {quickActions.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {quickActions.map((action) => (
                <Button
                  key={action.id}
                  variant={action.variant || 'outline'}
                  size="sm"
                  onClick={action.onClick}
                  className="flex items-center gap-2 whitespace-nowrap flex-shrink-0"
                >
                  <action.icon className="h-4 w-4" />
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {/* Filter Button */}
          {filterOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <Sheet open={showFilters} onOpenChange={setShowFilters}>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="relative">
                    <Filter className="h-4 w-4 mr-2" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge className="ml-2 h-5 w-5 p-0 text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80">
                  <div className="space-y-4 pt-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Filters</h3>
                      {activeFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={clearFilters}>
                          Clear All
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-4">
                      {filterOptions.map((filter) => (
                        <div key={filter.id} className="space-y-2">
                          <label className="text-sm font-medium">
                            {filter.label}
                          </label>
                          {/* Add specific filter components based on filter type */}
                          <Input
                            placeholder={`Filter by ${filter.label.toLowerCase()}`}
                            value={activeFilters[filter.id] || ''}
                            onChange={(e) => handleFilterChange(filter.id, e.target.value)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </SheetContent>
              </Sheet>

              {activeFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards Grid */}
      {statsCards.length > 0 && (
        <div className="px-4">
          <div className="grid grid-cols-2 gap-3">
            {statsCards.map((stat, index) => (
              <StatCard key={index} stat={stat} />
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="px-4">
        {children}
      </div>
    </div>
  );
};

// Hook for mobile-optimized module state management
export const useMobileModuleState = () => {
  const isMobile = useIsMobile();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Record<string, any>>({});

  const handleRefresh = useCallback(async (refreshFn: () => Promise<void>) => {
    setRefreshing(true);
    try {
      await refreshFn();
    } finally {
      setRefreshing(false);
    }
  }, []);

  return {
    isMobile,
    refreshing,
    searchTerm,
    filters,
    setSearchTerm,
    setFilters,
    handleRefresh
  };
};