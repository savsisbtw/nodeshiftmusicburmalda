import { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, FadeInDown, FadeOutDown,
  useAnimatedGestureHandler, runOnJS,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Font, Radius, Spacing, TAB_BAR_HEIGHT, MINI_PLAYER_HEIGHT } from '../constants/theme';
import { usePlayer } from '../store';
import { useAudio } from '../hooks/useAudio';
import { coverUrl } from '../services/api';

export default function MiniPlayer() {
  const { queue, index, playing, expanded, setExpanded } = usePlayer();
  const { togglePlay } = useAudio();
  const track  = queue[index];
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(0);
  const opacity    = useSharedValue(1);

  const gestureHandler = useAnimatedGestureHandler({
    onActive: (e) => {
      if (e.translationY < 0) {
        translateY.value = Math.max(e.translationY, -80);
        opacity.value = 1 + e.translationY / 80;
      }
    },
    onEnd: (e) => {
      if (e.translationY < -40 || e.velocityY < -400) {
        runOnJS(openPlayer)();
      }
      translateY.value = withSpring(0);
      opacity.value    = withSpring(1);
    },
  });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity:   opacity.value,
  }));

  const openPlayer = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(true);
  }, [setExpanded]);

  const onPlayPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    togglePlay();
  }, [togglePlay]);

  if (!track || expanded) return null;

  const cover = coverUrl(track.cover_url);

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View
        style={[styles.wrap, animStyle, { bottom: TAB_BAR_HEIGHT }]}
        entering={FadeInDown.springify()}
        exiting={FadeOutDown.springify()}
      >
        <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.border} />

        <Pressable style={styles.row} onPress={openPlayer} android_ripple={null}>
          {/* Cover */}
          <Image
            source={cover ? { uri: cover } : require('../assets/placeholder.png')}
            style={styles.cover}
            contentFit="cover"
            transition={200}
          />

          {/* Info */}
          <View style={styles.info}>
            <Text style={styles.title} numberOfLines={1}>{track.title}</Text>
            <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
          </View>

          {/* Play/Pause */}
          <Pressable
            style={styles.btn}
            onPress={onPlayPress}
            hitSlop={12}
          >
            {playing ? <PauseIcon /> : <PlayIcon />}
          </Pressable>

          {/* Next */}
          <Pressable
            style={styles.btn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              const next = usePlayer.getState().nextTrack();
              usePlayer.getState().setIndex(next);
            }}
            hitSlop={12}
          >
            <NextIcon />
          </Pressable>
        </Pressable>

        {/* Progress line */}
        <ProgressLine />
      </Animated.View>
    </PanGestureHandler>
  );
}

function ProgressLine() {
  const { progress, duration } = usePlayer();
  const pct = duration > 0 ? (progress / duration) * 100 : 0;
  return (
    <View style={styles.progressBg}>
      <View style={[styles.progressFill, { width: `${pct}%` as any }]} />
    </View>
  );
}

function PlayIcon()  { return <Svg width={20} height={20} viewBox="0 0 24 24" fill={Colors.text}><Path d="M8 5v14l11-7z" /></Svg>; }
function PauseIcon() { return <Svg width={20} height={20} viewBox="0 0 24 24" fill={Colors.text}><Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></Svg>; }
function NextIcon()  { return <Svg width={20} height={20} viewBox="0 0 24 24" fill={Colors.text}><Path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" /></Svg>; }

const styles = StyleSheet.create({
  wrap:        { position: 'absolute', left: 0, right: 0, height: MINI_PLAYER_HEIGHT, overflow: 'hidden' },
  border:      { position: 'absolute', top: 0, left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: Colors.border },
  row:         { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, gap: Spacing.md },
  cover:       { width: 42, height: 42, borderRadius: Radius.sm, backgroundColor: Colors.elevated },
  info:        { flex: 1 },
  title:       { color: Colors.text, fontSize: Font.sm, fontWeight: '600' },
  artist:      { color: Colors.text2, fontSize: Font.xs, marginTop: 2 },
  btn:         { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  progressBg:  { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: Colors.border },
  progressFill:{ height: 2, backgroundColor: Colors.green },
});
