/**
 * WaveAnimation — flowing wave bars used in "My Wave" header
 * Simulates audio wave / signal motion with staggered sine animation
 */
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, Easing, cancelAnimation,
} from 'react-native-reanimated';
import { Colors } from '../constants/theme';

interface Props {
  active?: boolean;
  barCount?: number;
  height?: number;
  color?: string;
}

const PHASES = [0, 0.4, 0.8, 0.2, 0.6, 0.1, 0.7, 0.3, 0.9, 0.5,
                0.15, 0.55, 0.85, 0.25, 0.65];
const BASE_DURATION = 900;

function WaveBar({ active, maxH, phase, color }: {
  active: boolean; maxH: number; phase: number; color: string;
}) {
  const h = useSharedValue(maxH * 0.15);

  useEffect(() => {
    if (active) {
      const delay = Math.round(phase * BASE_DURATION);
      h.value = withSequence(
        withTiming(maxH * 0.15, { duration: delay }),
        withRepeat(
          withSequence(
            withTiming(maxH, { duration: BASE_DURATION, easing: Easing.inOut(Easing.sin) }),
            withTiming(maxH * 0.1, { duration: BASE_DURATION, easing: Easing.inOut(Easing.sin) }),
          ),
          -1,
          false,
        )
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(maxH * 0.12, { duration: 400 });
    }
  }, [active]);

  const style = useAnimatedStyle(() => ({
    height: h.value,
    backgroundColor: color,
    borderRadius: 3,
    flex: 1,
    marginHorizontal: 1.5,
  }));

  return <Animated.View style={style} />;
}

export default function WaveAnimation({ active = true, barCount = 40, height = 56, color }: Props) {
  const bars = Array.from({ length: barCount }, (_, i) => i);
  const barColor = color ?? Colors.accent;

  return (
    <View style={[s.wrap, { height }]}>
      {bars.map((i) => (
        <WaveBar
          key={i}
          active={active}
          maxH={height}
          phase={PHASES[i % PHASES.length]}
          color={`${barColor}${Math.round(40 + (i % 5) * 24).toString(16).padStart(2, '0')}`}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', overflow: 'hidden' },
});
