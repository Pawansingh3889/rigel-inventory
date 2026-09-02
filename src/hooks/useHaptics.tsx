import React, { useCallback } from 'react';

export type HapticType = 'light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error';

interface HapticPattern {
  vibration: number | number[];
  description: string;
}

const HAPTIC_PATTERNS: Record<HapticType, HapticPattern> = {
  light: {
    vibration: 50,
    description: 'Light tap'
  },
  medium: {
    vibration: 100,
    description: 'Medium tap'
  },
  heavy: {
    vibration: 200,
    description: 'Heavy tap'
  },
  selection: {
    vibration: [50, 25, 50],
    description: 'Selection feedback'
  },
  success: {
    vibration: [100, 50, 100],
    description: 'Success confirmation'
  },
  warning: {
    vibration: [150, 100, 150, 100, 150],
    description: 'Warning alert'
  },
  error: {
    vibration: [200, 100, 200],
    description: 'Error notification'
  }
};

interface UseHapticsReturn {
  triggerHaptic: (type: HapticType) => void;
  isSupported: boolean;
  vibrate: (pattern: number | number[]) => void;
}

export const useHaptics = (): UseHapticsReturn => {
  const isSupported = 'vibrate' in navigator;

  const vibrate = useCallback((pattern: number | number[]) => {
    if (!isSupported) {
      console.warn('Haptic feedback not supported on this device');
      return;
    }

    try {
      navigator.vibrate(pattern);
    } catch (error) {
      console.warn('Failed to trigger vibration:', error);
    }
  }, [isSupported]);

  const triggerHaptic = useCallback((type: HapticType) => {
    if (!isSupported) return;

    const pattern = HAPTIC_PATTERNS[type];
    if (pattern) {
      vibrate(pattern.vibration);
    }
  }, [vibrate, isSupported]);

  return {
    triggerHaptic,
    isSupported,
    vibrate
  };
};

// React hook for haptic feedback on interactions
export const useHapticInteraction = () => {
  const { triggerHaptic } = useHaptics();

  const onTap = useCallback(() => triggerHaptic('light'), [triggerHaptic]);
  const onSelect = useCallback(() => triggerHaptic('selection'), [triggerHaptic]);
  const onSuccess = useCallback(() => triggerHaptic('success'), [triggerHaptic]);
  const onError = useCallback(() => triggerHaptic('error'), [triggerHaptic]);
  const onWarning = useCallback(() => triggerHaptic('warning'), [triggerHaptic]);

  return {
    onTap,
    onSelect,
    onSuccess,
    onError,
    onWarning,
    triggerHaptic
  };
};

// HOC for adding haptic feedback to components
export const withHaptics = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  hapticType: HapticType = 'light'
) => {
  return React.forwardRef<any, React.PropsWithRef<P>>((props, ref) => {
    const { triggerHaptic } = useHaptics();

    const handleInteraction = useCallback(() => {
      triggerHaptic(hapticType);
    }, [triggerHaptic]);

    return (
      <WrappedComponent
        {...(props as P)}
        ref={ref}
        onClick={handleInteraction}
      />
    );
  });
};