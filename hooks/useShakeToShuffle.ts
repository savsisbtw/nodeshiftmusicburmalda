/**
 * useShakeToShuffle — accelerometer-based shake detection
 * Triggers callback when device is shaken hard enough
 */
import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';
import * as Haptics from 'expo-haptics';

const SHAKE_THRESHOLD = 2.2;
const SHAKE_COOLDOWN  = 1500; // ms

export function useShakeToShuffle(onShake: () => void) {
  const lastShake = useRef(0);

  useEffect(() => {
    Accelerometer.setUpdateInterval(100);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const acc = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (acc > SHAKE_THRESHOLD && now - lastShake.current > SHAKE_COOLDOWN) {
        lastShake.current = now;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onShake();
      }
    });
    return () => sub.remove();
  }, [onShake]);
}
