import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, X, Zap, RotateCcw } from 'lucide-react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { cn } from '@/lib/utils';

interface BarcodeScannerProps {
  onScan: (result: string) => void;
  onClose: () => void;
  isActive: boolean;
  productMode?: boolean; // Whether scanning for product lookup
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScan,
  onClose,
  isActive,
  productMode = false
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [codeReader] = useState(() => new BrowserMultiFormatReader());
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  // Initialize scanner
  useEffect(() => {
    if (!isActive) return;

    startScanning();
    
    return () => {
      stopScanning();
    };
  }, [isActive, facingMode]);

  const startScanning = async () => {
    try {
      setError(null);
      setScanning(true);

      // Stop any existing stream
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Check for torch support
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      setTorchSupported('torch' in capabilities);

      // Start decoding
      codeReader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            const scannedText = result.getText();
            onScan(scannedText);
            
            // Haptic feedback if supported
            if ('vibrate' in navigator) {
              navigator.vibrate(200);
            }
          }
        }
      );

    } catch (err) {
      console.error('Error starting scanner:', err);
      setError('Camera access denied or not available');
      setScanning(false);
    }
  };

  const stopScanning = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    codeReader.reset();
    setScanning(false);
  };

  const toggleTorch = async () => {
    if (!stream || !torchSupported) return;

    try {
      const track = stream.getVideoTracks()[0];
      await track.applyConstraints({
        advanced: [{ torch: !torchEnabled } as any]
      });
      setTorchEnabled(!torchEnabled);
    } catch (err) {
      console.error('Error toggling torch:', err);
    }
  };

  const switchCamera = () => {
    setFacingMode(current => current === 'user' ? 'environment' : 'user');
  };

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-white" />
            <span className="text-white font-medium">
              {productMode ? 'Scan Product Barcode' : 'Barcode Scanner'}
            </span>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-white hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Video Preview */}
      <div className="relative h-full">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Scan Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative">
            {/* Scanning frame */}
            <div className="w-64 h-64 border-2 border-primary relative">
              <div className="absolute top-0 left-0 w-8 h-8 border-l-4 border-t-4 border-white"></div>
              <div className="absolute top-0 right-0 w-8 h-8 border-r-4 border-t-4 border-white"></div>
              <div className="absolute bottom-0 left-0 w-8 h-8 border-l-4 border-b-4 border-white"></div>
              <div className="absolute bottom-0 right-0 w-8 h-8 border-r-4 border-b-4 border-white"></div>
              
              {/* Scanning line animation */}
              {scanning && (
                <div className="absolute inset-x-0 top-0 h-0.5 bg-primary animate-pulse"></div>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-4 text-center">
              <p className="text-white/80">
                {productMode 
                  ? 'Position barcode within the frame'
                  : 'Align barcode with the scanning area'
                }
              </p>
              {scanning && (
                <Badge variant="secondary" className="mt-2">
                  Scanning...
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Card className="mx-4">
              <CardHeader>
                <CardTitle className="text-destructive">Camera Error</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4">{error}</p>
                <Button onClick={startScanning} variant="outline" className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Controls */}
        <div className="absolute bottom-8 left-0 right-0">
          <div className="flex justify-center gap-4">
            {torchSupported && (
              <Button
                variant="ghost"
                size="lg"
                onClick={toggleTorch}
                className={cn(
                  "text-white hover:bg-white/20 rounded-full h-12 w-12",
                  torchEnabled && "bg-white/20"
                )}
              >
                <Zap className={cn("h-5 w-5", torchEnabled && "fill-current")} />
              </Button>
            )}
            
            <Button
              variant="ghost"
              size="lg"
              onClick={switchCamera}
              className="text-white hover:bg-white/20 rounded-full h-12 w-12"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};