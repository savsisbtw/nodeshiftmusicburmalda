/**
 * useShakeToShuffle — accelerometer-based shake detection
 * Safely handles missing expo-sensors native module
 */
import { useEffect, useRef } from 'react';
import * as Haptics from 'expo-haptics';

const SHAKE_THRESHOLD = 2.2;
const SHAKE_COOLDOWN  = 1500;

export function useShakeToShuffle(onShake: () => void) {
  const lastShake = useRef(0);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    try {
      // Lazily import so missing native module doesn't crash on load
      const { Accelerometer } = require('expo-sensors');
      Accelerometer.setUpdateInterval(100);
      sub = Accelerometer.addListener(({ x, y, z }: { x: number; y: number; z: number }) => {
        const acc = Math.sqrt(x * x + y * y + z * z);
        const now = Date.now();
        if (acc > SHAKE_THRESHOLD && now - lastShake.current > SHAKE_COOLDOWN) {
          lastShake.current = now;
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          onShake();
        }
      });
    } catch {
      // expo-sensors not linked — shake disabled, no crash
    }
    return () => { try { sub?.remove(); } catch {} };
  }, [onShake]);
}
