import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, X, RotateCcw, Download, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhotoCaptureProps {
  onCapture: (imageBlob: Blob, imageUrl: string) => void;
  onClose: () => void;
  isActive: boolean;
  maxPhotos?: number;
}

interface CapturedPhoto {
  id: string;
  blob: Blob;
  url: string;
  timestamp: number;
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  onCapture,
  onClose,
  isActive,
  maxPhotos = 5
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize camera
  React.useEffect(() => {
    if (!isActive) return;

    initializeCamera();
    
    return () => {
      stopCamera();
    };
  }, [isActive, facingMode]);

  const initializeCamera = async () => {
    try {
      setError(null);

      // Stop existing stream
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
    } catch (err) {
      console.error('Error initializing camera:', err);
      setError('Camera access denied or not available');
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;

    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) throw new Error('Could not get canvas context');

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw the video frame to canvas
      context.drawImage(video, 0, 0);

      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const photo: CapturedPhoto = {
            id: `photo-${Date.now()}`,
            blob,
            url,
            timestamp: Date.now()
          };

          setCapturedPhotos(prev => {
            const updated = [...prev, photo];
            // Limit number of photos
            if (updated.length > maxPhotos) {
              const removed = updated.shift();
              if (removed) {
                URL.revokeObjectURL(removed.url);
              }
            }
            return updated;
          });

          // Haptic feedback
          if ('vibrate' in navigator) {
            navigator.vibrate(100);
          }

          // Call onCapture for immediate use
          onCapture(blob, url);
        }
        setIsCapturing(false);
      }, 'image/jpeg', 0.8);

    } catch (err) {
      console.error('Error capturing photo:', err);
      setIsCapturing(false);
    }
  }, [onCapture, isCapturing, maxPhotos]);

  const deletePhoto = (id: string) => {
    setCapturedPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.url);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const downloadPhoto = (photo: CapturedPhoto) => {
    const link = document.createElement('a');
    link.href = photo.url;
    link.download = `photo-${new Date(photo.timestamp).toISOString()}.jpg`;
    link.click();
  };

  const switchCamera = () => {
    setFacingMode(current => current === 'user' ? 'environment' : 'user');
  };

  // Cleanup URLs on unmount
  React.useEffect(() => {
    return () => {
      capturedPhotos.forEach(photo => {
        URL.revokeObjectURL(photo.url);
      });
    };
  }, []);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Hidden canvas for photo capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-white" />
            <span className="text-white font-medium">Product Photos</span>
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

      {/* Main Content */}
      <div className="flex flex-col h-full pt-16">
        {/* Camera Preview */}
        <div className="flex-1 relative">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <Card className="mx-4">
                <CardHeader>
                  <CardTitle className="text-destructive">Camera Error</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4">{error}</p>
                  <Button onClick={initializeCamera} variant="outline" className="w-full">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Try Again
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Controls */}
        <div className="p-4">
          <div className="flex justify-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={switchCamera}
              className="text-white hover:bg-white/20 rounded-full h-12 w-12"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>

            <Button
              size="lg"
              onClick={capturePhoto}
              disabled={isCapturing || !!error}
              className={cn(
                "rounded-full h-16 w-16 bg-white text-black hover:bg-white/90",
                isCapturing && "opacity-50"
              )}
            >
              <Camera className="h-6 w-6" />
            </Button>

            <div className="w-12" /> {/* Spacer for symmetry */}
          </div>

          {/* Recent Photos */}
          {capturedPhotos.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {capturedPhotos.map((photo) => (
                <div key={photo.id} className="relative flex-shrink-0">
                  <img
                    src={photo.url}
                    alt="Captured"
                    className="w-16 h-16 object-cover rounded-lg border-2 border-white/20"
                  />
                  <div className="absolute -top-2 -right-2 flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deletePhoto(photo.id)}
                      className="h-6 w-6 p-0 rounded-full"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => downloadPhoto(photo)}
                      className="h-6 w-6 p-0 rounded-full"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};