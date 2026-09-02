import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarcodeScanner } from '@/components/camera/BarcodeScanner';
import { PhotoCapture } from '@/components/camera/PhotoCapture';
import { LocationTracker } from '@/components/location/LocationTracker';
import { NetworkStatus } from '@/components/offline/NetworkStatus';
import { MobileFAB } from '@/components/ui/mobile-fab';
import { useIsMobile } from '@/hooks/use-mobile';
import { useHapticInteraction } from '@/hooks/useHaptics';
import { Camera, QrCode, MapPin, Wifi, Plus, Search, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { offlineManager } from '@/services/offlineManager';

interface EnhancedInventoryModuleProps {
  children?: React.ReactNode;
}

export const EnhancedInventoryModule: React.FC<EnhancedInventoryModuleProps> = ({ children }) => {
  const [activeFeature, setActiveFeature] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<string>('');
  const [capturedPhotos, setCapturedPhotos] = useState<string[]>([]);
  const [locationData, setLocationData] = useState<any>(null);
  
  const isMobile = useIsMobile();
  const { onTap, onSuccess } = useHapticInteraction();
  const { toast } = useToast();

  const handleBarcodeScanned = async (result: string) => {
    onSuccess();
    setScannedData(result);
    setActiveFeature(null);
    
    toast({
      title: "Barcode Scanned",
      description: `Found: ${result}`,
    });

    // Search for product in offline storage first
    try {
      const products = await offlineManager.searchProducts('by-sku', result);
      if (products.length > 0) {
        toast({
          title: "Product Found",
          description: `${products[0].name} - ${products[0].sku}`,
        });
      }
    } catch (error) {
      console.error('Error searching products:', error);
    }
  };

  const handlePhotoCapture = (imageBlob: Blob, imageUrl: string) => {
    onTap();
    setCapturedPhotos(prev => [...prev, imageUrl]);
    
    toast({
      title: "Photo Captured",
      description: "Photo added to product gallery",
    });
  };

  const handleLocationUpdate = (location: any) => {
    onTap();
    setLocationData(location);
    
    toast({
      title: "Location Updated",
      description: `${location.address || 'Location captured'}`,
    });
  };

  const fabActions = [
    {
      id: 'scan',
      label: 'Scan Barcode',
      icon: QrCode,
      onClick: () => setActiveFeature('scanner')
    },
    {
      id: 'photo',
      label: 'Take Photo',
      icon: Camera,
      onClick: () => setActiveFeature('camera')
    },
    {
      id: 'location',
      label: 'Get Location',
      icon: MapPin,
      onClick: () => setActiveFeature('location')
    },
    {
      id: 'add',
      label: 'Add Product',
      icon: Plus,
      onClick: () => {
        onTap();
        // Trigger add product action
        toast({ title: "Add Product", description: "Opening product form..." });
      }
    }
  ];

  return (
    <div className="space-y-6">
      {/* Network Status */}
      <NetworkStatus showDetails={false} />

      {/* Enhanced Features Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Advanced Inventory Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="scanner">Scanner</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-auto flex-col p-4"
                  onClick={() => setActiveFeature('scanner')}
                >
                  <QrCode className="h-8 w-8 mb-2" />
                  <span className="text-sm">Scan Barcode</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto flex-col p-4"
                  onClick={() => setActiveFeature('camera')}
                >
                  <Camera className="h-8 w-8 mb-2" />
                  <span className="text-sm">Take Photo</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto flex-col p-4"
                  onClick={() => setActiveFeature('location')}
                >
                  <MapPin className="h-8 w-8 mb-2" />
                  <span className="text-sm">Track Location</span>
                </Button>
                
                <Button
                  variant="outline"
                  className="h-auto flex-col p-4"
                  onClick={() => setActiveFeature('offline')}
                >
                  <Wifi className="h-8 w-8 mb-2" />
                  <span className="text-sm">Offline Mode</span>
                </Button>
              </div>

              {/* Recent Activity */}
              <div className="space-y-2">
                <h4 className="font-medium">Recent Activity</h4>
                
                {scannedData && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <QrCode className="h-4 w-4" />
                    <span className="text-sm">Last scanned: {scannedData}</span>
                  </div>
                )}
                
                {capturedPhotos.length > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <Camera className="h-4 w-4" />
                    <span className="text-sm">{capturedPhotos.length} photos captured</span>
                  </div>
                )}
                
                {locationData && (
                  <div className="flex items-center gap-2 p-2 bg-muted rounded">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">
                      Location: {locationData.address || `${locationData.latitude?.toFixed(4)}, ${locationData.longitude?.toFixed(4)}`}
                    </span>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="scanner" className="space-y-4">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Use the barcode scanner to quickly find products
                </p>
                <Button onClick={() => setActiveFeature('scanner')}>
                  <QrCode className="h-4 w-4 mr-2" />
                  Open Scanner
                </Button>
                
                {scannedData && (
                  <div className="p-4 border rounded-md">
                    <h4 className="font-medium mb-2">Last Scan Result:</h4>
                    <Badge variant="secondary">{scannedData}</Badge>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="photos" className="space-y-4">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Capture product photos for documentation
                </p>
                <Button onClick={() => setActiveFeature('camera')}>
                  <Camera className="h-4 w-4 mr-2" />
                  Open Camera
                </Button>
                
                {capturedPhotos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {capturedPhotos.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Captured ${index + 1}`}
                        className="w-full h-20 object-cover rounded border"
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="location" className="space-y-4">
              <LocationTracker
                onLocationUpdate={handleLocationUpdate}
                trackingMode="single"
                accuracy="medium"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Original children content */}
      {children}

      {/* Camera Features */}
      {activeFeature === 'scanner' && (
        <BarcodeScanner
          isActive={true}
          onScan={handleBarcodeScanned}
          onClose={() => setActiveFeature(null)}
          productMode={true}
        />
      )}

      {activeFeature === 'camera' && (
        <PhotoCapture
          isActive={true}
          onCapture={handlePhotoCapture}
          onClose={() => setActiveFeature(null)}
          maxPhotos={10}
        />
      )}

      {/* Offline Status Panel */}
      {activeFeature === 'offline' && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
          <div className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] p-6">
            <NetworkStatus showDetails={true} />
            <div className="mt-4 flex justify-center">
              <Button onClick={() => setActiveFeature(null)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile FAB */}
      {isMobile && (
        <MobileFAB
          actions={fabActions}
          className="md:hidden"
        />
      )}
    </div>
  );
};