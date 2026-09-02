import React, { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Wifi, WifiOff, RefreshCw, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { offlineManager } from '@/services/offlineManager';
import { cn } from '@/lib/utils';

interface NetworkStatusProps {
  className?: string;
  showDetails?: boolean;
}

export const NetworkStatus: React.FC<NetworkStatusProps> = ({ 
  className,
  showDetails = false 
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncStatus, setSyncStatus] = useState({
    pendingSyncItems: 0,
    isSyncing: false
  });
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

  useEffect(() => {
    // Initial status check
    updateSyncStatus();
    updateCacheStats();

    // Network status listener
    const handleNetworkChange = (event: any) => {
      setIsOnline(event.detail.isOnline);
      updateSyncStatus();
    };

    window.addEventListener('networkStatusChange', handleNetworkChange);

    // Regular status updates
    const statusInterval = setInterval(() => {
      updateSyncStatus();
      if (showDetails) {
        updateCacheStats();
      }
    }, 2000);

    return () => {
      window.removeEventListener('networkStatusChange', handleNetworkChange);
      clearInterval(statusInterval);
    };
  }, [showDetails]);

  const updateSyncStatus = async () => {
    const status = offlineManager.getNetworkStatus();
    setSyncStatus({
      pendingSyncItems: status.pendingSyncItems,
      isSyncing: status.isSyncing
    });

    if (status.isSyncing) {
      setLastSyncTime(new Date());
    }
  };

  const updateCacheStats = async () => {
    const stats = await offlineManager.getCacheStats();
    setCacheStats(stats);
  };

  const handleManualSync = async () => {
    if (isOnline) {
      await offlineManager.processSyncQueue();
      updateSyncStatus();
    }
  };

  const handleClearCache = async () => {
    await offlineManager.clearCache();
    updateCacheStats();
  };

  if (!showDetails) {
    // Simple status indicator
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <Badge 
          variant={isOnline ? "default" : "destructive"}
          className="flex items-center gap-1"
        >
          {isOnline ? (
            <Wifi className="h-3 w-3" />
          ) : (
            <WifiOff className="h-3 w-3" />
          )}
          {isOnline ? 'Online' : 'Offline'}
        </Badge>

        {syncStatus.pendingSyncItems > 0 && (
          <Badge variant="outline" className="flex items-center gap-1">
            <Database className="h-3 w-3" />
            {syncStatus.pendingSyncItems} pending
          </Badge>
        )}

        {syncStatus.isSyncing && (
          <Badge variant="secondary" className="flex items-center gap-1 animate-pulse">
            <RefreshCw className="h-3 w-3 animate-spin" />
            Syncing
          </Badge>
        )}
      </div>
    );
  }

  // Detailed status card
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-500" />
          ) : (
            <WifiOff className="h-5 w-5 text-red-500" />
          )}
          Network & Sync Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Connection Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Connection:</span>
          <Badge variant={isOnline ? "default" : "destructive"}>
            {isOnline ? 'Online' : 'Offline'}
          </Badge>
        </div>

        {/* Sync Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Sync Status:</span>
            {syncStatus.isSyncing ? (
              <Badge variant="secondary" className="animate-pulse">
                <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                Syncing
              </Badge>
            ) : syncStatus.pendingSyncItems > 0 ? (
              <Badge variant="outline">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {syncStatus.pendingSyncItems} Pending
              </Badge>
            ) : (
              <Badge variant="default">
                <CheckCircle className="h-3 w-3 mr-1" />
                Up to date
              </Badge>
            )}
          </div>

          {syncStatus.pendingSyncItems > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                {syncStatus.pendingSyncItems} changes waiting to sync
              </div>
              {isOnline && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManualSync}
                  disabled={syncStatus.isSyncing}
                  className="w-full"
                >
                  <RefreshCw className={cn(
                    "h-3 w-3 mr-2",
                    syncStatus.isSyncing && "animate-spin"
                  )} />
                  Sync Now
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Last Sync */}
        {lastSyncTime && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last sync:</span>
            <span>{lastSyncTime.toLocaleTimeString()}</span>
          </div>
        )}

        {/* Cache Statistics */}
        {cacheStats && (
          <div className="space-y-3 pt-2 border-t">
            <span className="text-sm font-medium">Offline Cache:</span>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Products:</span>
                <span>{cacheStats.products}</span>
              </div>
              <div className="flex justify-between">
                <span>Orders:</span>
                <span>{cacheStats.orders}</span>
              </div>
              <div className="flex justify-between">
                <span>Inventory:</span>
                <span>{cacheStats.inventory}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total:</span>
                <span>{cacheStats.total}</span>
              </div>
            </div>

            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearCache}
              className="w-full text-xs"
            >
              Clear Cache
            </Button>
          </div>
        )}

        {/* Offline Mode Indicator */}
        {!isOnline && (
          <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-md">
            <div className="flex items-center gap-2 text-xs">
              <AlertTriangle className="h-3 w-3" />
              <span>Working offline. Changes will sync when connected.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};