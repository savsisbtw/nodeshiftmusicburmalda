/**
 * SpectrumBars — animated equalizer bars for MiniPlayer / Player
 */
import { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence,
  withTiming, Easing, cancelAnimation,
} from 'react-native-reanimated';

interface Props {
  playing: boolean;
  color?: string;
  barCount?: number;
  height?: number;
}

const DURATIONS = [420, 350, 500, 380, 460];
const HEIGHTS   = [0.4, 0.7, 0.55, 0.85, 0.5];

function Bar({ playing, color, maxH, duration, minRatio }: {
  playing: boolean; color: string; maxH: number; duration: number; minRatio: number;
}) {
  const h = useSharedValue(maxH * minRatio);

  useEffect(() => {
    if (playing) {
      h.value = withRepeat(
        withSequence(
          withTiming(maxH, { duration, easing: Easing.inOut(Easing.ease) }),
          withTiming(maxH * 0.2, { duration, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      cancelAnimation(h);
      h.value = withTiming(maxH * 0.25, { duration: 300 });
    }
  }, [playing]);

  const style = useAnimatedStyle(() => ({
    height: h.value,
    backgroundColor: color,
    borderRadius: 2,
    width: 3,
  }));

  return <Animated.View style={style} />;
}

export default function SpectrumBars({ playing, color = '#ffffff', barCount = 4, height = 18 }: Props) {
  const bars = Array.from({ length: barCount }, (_, i) => i);

  return (
    <View style={[s.wrap, { height }]}>
      {bars.map((i) => (
        <Bar
          key={i}
          playing={playing}
          color={color}
          maxH={height * (HEIGHTS[i % HEIGHTS.length])}
          duration={DURATIONS[i % DURATIONS.length]}
          minRatio={0.2}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
});
