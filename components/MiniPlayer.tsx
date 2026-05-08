import { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  useAnimatedGestureHandler, runOnJS, interpolate, Extrapolate, Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Rect } from 'react-native-svg';
import { Colors, Font, MINI_PLAYER_HEIGHT, TAB_BAR_HEIGHT } from '../constants/theme';
import { usePlayer, useLikes } from '../store';
import { togglePlay } from '../hooks/useAudio';
import { coverUrl } from '../services/api';
import SpectrumBars from './SpectrumBars';

export default function MiniPlayer() {
  const { queue, index, playing, expanded, setExpanded, progress, duration } = usePlayer();
  const { toggleLike, isLiked } = useLikes();
  const track = queue[index];

  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const openPlayer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExpanded(true);
    translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
    opacity.value = withSpring(1);
  }, [setExpanded]);

  const gestureHandler = useAnimatedGestureHandler<any, { start: number }>({
    onStart: (_, ctx) => {
      cancelAnimation(translateY);
      ctx.start = translateY.value;
    },
    onActive: (e) => {
      let dy = e.translationY;
      if (dy > 0) {
        dy = dy * 0.15; // rubber band resistance when dragging down
      }
      translateY.value = Math.max(dy, -150);
      opacity.value = interpolate(dy, [-100, 0], [0.5, 1], Extrapolate.CLAMP);
    },
    onEnd: (e) => {
      const shouldOpen = e.translationY < -40 || e.velocityY < -600;
      if (shouldOpen) {
        translateY.value = withTiming(-MINI_PLAYER_HEIGHT, {
          duration: 200, easing: Easing.out(Easing.cubic),
        }, () => runOnJS(openPlayer)());
      } else {
        translateY.value = withSpring(0, { damping: 22, stiffness: 250 });
        opacity.value = withSpring(1);
      }
    },
    onFail: () => {
      translateY.value = withSpring(0, { damping: 22, stiffness: 250 });
      opacity.value = withSpring(1);
    },
    onCancel: () => {
      translateY.value = withSpring(0, { damping: 22, stiffness: 250 });
      opacity.value = withSpring(1);
    },
  });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const onNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ni = usePlayer.getState().nextTrack();
    usePlayer.getState().setIndex(ni);
  }, []);

  if (!track || expanded) return null;

  const cover = coverUrl(track.cover_url);
  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  const liked = isLiked(track.id);

  return (
    <PanGestureHandler
      onGestureEvent={gestureHandler}
      activeOffsetY={[-8, 8]}
      failOffsetX={[-20, 20]}
    >
      <Animated.View style={[s.wrap, animStyle, { bottom: TAB_BAR_HEIGHT }]}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, s.bgTint]} />

        {/* Progress bar */}
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${pct}%` as any }]} />
        </View>

        <Pressable style={s.row} onPress={openPlayer}>
          <Image
            source={cover ? { uri: cover } : require('../assets/placeholder.png')}
            style={s.cover}
            contentFit="cover"
            transition={200}
          />
          <View style={s.info}>
            <Text style={s.title} numberOfLines={1}>{track.title}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {playing && <SpectrumBars playing={playing} color={Colors.accent} barCount={4} height={14} />}
              <Text style={s.artist} numberOfLines={1}>{track.artist}</Text>
            </View>
          </View>
          <View style={s.controls}>
            <Pressable
              onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleLike(track.id); }}
              hitSlop={12} style={s.ctlBtn}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill={liked ? Colors.pink : 'none'}>
                <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={liked ? Colors.pink : Colors.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); togglePlay(); }}
              hitSlop={12} style={s.ctlBtn}
            >
              {playing
                ? <Svg width={22} height={22} viewBox="0 0 24 24" fill={Colors.text}>
                    <Rect x={5} y={4} width={4} height={16} rx={1.5} fill={Colors.text} />
                    <Rect x={15} y={4} width={4} height={16} rx={1.5} fill={Colors.text} />
                  </Svg>
                : <Svg width={22} height={22} viewBox="0 0 24 24" fill={Colors.text}>
                    <Path d="M8 5v14l11-7z" />
                  </Svg>
              }
            </Pressable>
            <Pressable
              onPress={(e) => { e.stopPropagation(); onNext(); }}
              hitSlop={12} style={s.ctlBtn}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill={Colors.text}>
                <Path d="M5 4l10 8-10 8V4zM19 4h-2v16h2z" />
              </Svg>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </PanGestureHandler>
  );
}

const s = StyleSheet.create({
  wrap:         { position: 'absolute', left: 8, right: 8, height: MINI_PLAYER_HEIGHT, overflow: 'hidden', borderRadius: 16 },
  bgTint:       { backgroundColor: 'rgba(18,18,20,0.5)' },
  progressBg:   { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.06)', zIndex: 2 },
  progressFill: { height: 2, backgroundColor: Colors.accent },
  row:          { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 2, gap: 10 },
  cover:        { width: 46, height: 46, borderRadius: 10, backgroundColor: Colors.elevated },
  info:         { flex: 1, minWidth: 0 },
  title:        { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  artist:       { color: 'rgba(255,255,255,0.5)', fontSize: Font.xs, marginTop: 2 },
  controls:     { flexDirection: 'row', alignItems: 'center' },
  ctlBtn:       { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
