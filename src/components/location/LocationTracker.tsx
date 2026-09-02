import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  address?: string;
}

interface LocationTrackerProps {
  onLocationUpdate: (location: LocationData) => void;
  trackingMode?: 'single' | 'continuous';
  accuracy?: 'low' | 'medium' | 'high';
}

export const LocationTracker: React.FC<LocationTrackerProps> = ({
  onLocationUpdate,
  trackingMode = 'single',
  accuracy = 'medium'
}) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);
  const { toast } = useToast();

  // Get accuracy settings
  const getPositionOptions = useCallback((): PositionOptions => {
    const accuracySettings = {
      low: { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
      medium: { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      high: { enableHighAccuracy: true, timeout: 30000, maximumAge: 10000 }
    };
    return accuracySettings[accuracy];
  }, [accuracy]);

  // Reverse geocoding to get address
  const getAddressFromCoords = async (lat: number, lng: number): Promise<string | undefined> => {
    try {
      // Using a free geocoding service (you can replace with your preferred service)
      const response = await fetch(
        `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
      );
      
      if (response.ok) {
        const data = await response.json();
        return `${data.locality || ''}, ${data.principalSubdivision || ''}, ${data.countryName || ''}`.replace(/^,\s*|,\s*$/g, '');
      }
    } catch (err) {
      console.warn('Geocoding failed:', err);
    }
    return undefined;
  };

  // Handle successful location
  const handleLocationSuccess = useCallback(async (position: GeolocationPosition) => {
    const { latitude, longitude, accuracy } = position.coords;
    
    const locationData: LocationData = {
      latitude,
      longitude,
      accuracy,
      timestamp: Date.now()
    };

    // Get address if possible
    try {
      const address = await getAddressFromCoords(latitude, longitude);
      if (address) {
        locationData.address = address;
      }
    } catch (err) {
      console.warn('Failed to get address:', err);
    }

    setCurrentLocation(locationData);
    setError(null);
    onLocationUpdate(locationData);

    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(100);
    }

    toast({
      title: "Location Updated",
      description: `Accuracy: ${Math.round(accuracy)}m${locationData.address ? ` - ${locationData.address}` : ''}`,
    });
  }, [onLocationUpdate, toast]);

  // Handle location error
  const handleLocationError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Unknown location error';
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied by user';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out';
        break;
    }

    setError(errorMessage);
    setIsTracking(false);
    
    toast({
      title: "Location Error",
      description: errorMessage,
      variant: "destructive",
    });
  }, [toast]);

  // Get single location
  const getCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setIsTracking(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      handleLocationSuccess,
      handleLocationError,
      getPositionOptions()
    );

    // Set timeout to stop tracking indicator
    setTimeout(() => {
      if (!currentLocation) {
        setIsTracking(false);
      }
    }, getPositionOptions().timeout || 15000);
  }, [handleLocationSuccess, handleLocationError, getPositionOptions, currentLocation]);

  // Start continuous tracking
  const startContinuousTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser');
      return;
    }

    setIsTracking(true);
    setError(null);

    const id = navigator.geolocation.watchPosition(
      handleLocationSuccess,
      handleLocationError,
      getPositionOptions()
    );

    setWatchId(id);
  }, [handleLocationSuccess, handleLocationError, getPositionOptions]);

  // Stop continuous tracking
  const stopContinuousTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
    }
    setIsTracking(false);
  }, [watchId]);

  // Toggle tracking based on mode
  const toggleTracking = () => {
    if (trackingMode === 'single') {
      getCurrentLocation();
    } else {
      if (isTracking) {
        stopContinuousTracking();
      } else {
        startContinuousTracking();
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  // Format coordinates for display
  const formatCoordinate = (value: number, isLatitude: boolean) => {
    const direction = isLatitude ? (value >= 0 ? 'N' : 'S') : (value >= 0 ? 'E' : 'W');
    return `${Math.abs(value).toFixed(6)}° ${direction}`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Tracking
          {isTracking && (
            <Badge variant="secondary" className="animate-pulse">
              {trackingMode === 'continuous' ? 'Tracking' : 'Getting Location'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Location Display */}
        {currentLocation && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Latitude:</span>
                <div className="font-mono">
                  {formatCoordinate(currentLocation.latitude, true)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Longitude:</span>
                <div className="font-mono">
                  {formatCoordinate(currentLocation.longitude, false)}
                </div>
              </div>
            </div>
            
            <div className="text-sm">
              <span className="text-muted-foreground">Accuracy:</span>
              <span className="ml-2 font-medium">±{Math.round(currentLocation.accuracy)}m</span>
            </div>

            {currentLocation.address && (
              <div className="text-sm">
                <span className="text-muted-foreground">Address:</span>
                <div className="mt-1">{currentLocation.address}</div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              Updated: {new Date(currentLocation.timestamp).toLocaleString()}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2">
          <Button
            onClick={toggleTracking}
            disabled={isTracking && trackingMode === 'single'}
            variant={isTracking && trackingMode === 'continuous' ? 'destructive' : 'default'}
            className="flex-1"
          >
            {isTracking ? (
              trackingMode === 'continuous' ? (
                <>
                  <MapPin className="h-4 w-4 mr-2" />
                  Stop Tracking
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Getting Location...
                </>
              )
            ) : (
              <>
                <Navigation className="h-4 w-4 mr-2" />
                {trackingMode === 'continuous' ? 'Start Tracking' : 'Get Location'}
              </>
            )}
          </Button>

          {currentLocation && (
            <Button
              variant="outline"
              onClick={() => {
                const coords = `${currentLocation.latitude},${currentLocation.longitude}`;
                const url = `https://www.google.com/maps?q=${coords}`;
                window.open(url, '_blank');
              }}
            >
              <MapPin className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Accuracy Indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Accuracy Mode: {accuracy.toUpperCase()}</span>
          {currentLocation && (
            <Badge variant={currentLocation.accuracy < 10 ? 'default' : currentLocation.accuracy < 50 ? 'secondary' : 'outline'}>
              {currentLocation.accuracy < 10 ? 'High' : currentLocation.accuracy < 50 ? 'Medium' : 'Low'} Precision
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};