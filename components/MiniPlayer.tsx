import { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  FadeInDown, FadeOutDown, useAnimatedGestureHandler, runOnJS,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';
import { Colors, Font, MINI_PLAYER_HEIGHT, TAB_BAR_HEIGHT } from '../constants/theme';
import { usePlayer, useLikes } from '../store';
import { togglePlay, seekTo } from '../hooks/useAudio';
import { coverUrl } from '../services/api';

export default function MiniPlayer() {
  const { queue, index, playing, expanded, setExpanded, progress, duration } = usePlayer();
  const { toggleLike, isLiked } = useLikes();
  const track = queue[index];

  const translateY = useSharedValue(0);
  const opacity    = useSharedValue(1);

  const gestureHandler = useAnimatedGestureHandler({
    onActive: (e) => {
      if (e.translationY < 0) {
        translateY.value = Math.max(e.translationY, -80);
        opacity.value    = 1 + e.translationY / 80;
      }
    },
    onEnd: (e) => {
      if (e.translationY < -40 || e.velocityY < -400) runOnJS(openPlayer)();
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

  const onNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ni = usePlayer.getState().nextTrack();
    usePlayer.getState().setIndex(ni);
  }, []);

  const onPrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const pi = usePlayer.getState().prevTrack();
    usePlayer.getState().setIndex(pi);
  }, []);

  if (!track || expanded) return null;

  const cover = coverUrl(track.cover_url);
  const liked = isLiked(track.id);
  const pct   = duration > 0 ? (progress / duration) * 100 : 0;

  return (
    <PanGestureHandler onGestureEvent={gestureHandler}>
      <Animated.View
        style={[s.wrap, animStyle, { bottom: TAB_BAR_HEIGHT }]}
        entering={FadeInDown.springify()}
        exiting={FadeOutDown.springify()}
      >
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, s.bgTint]} />

        {/* Progress line */}
        <View style={s.progressBg}>
          <View style={[s.progressFill, { width: `${pct}%` as any }]} />
        </View>

        <Pressable style={s.row} onPress={openPlayer} android_ripple={null}>
          <Image
            source={cover ? { uri: cover } : require('../assets/placeholder.png')}
            style={s.cover}
            contentFit="cover"
            transition={200}
          />
          <View style={s.info}>
            <Text style={s.title} numberOfLines={1}>{track.title}</Text>
            <Text style={s.artist} numberOfLines={1}>{track.artist}</Text>
          </View>
          <View style={s.controls}>
            <Pressable onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleLike(track.id); }} hitSlop={10} style={s.ctlBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill={liked ? Colors.pink : 'none'}>
                <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={liked ? Colors.pink : Colors.text2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Pressable onPress={(e) => { e.stopPropagation(); onPrev(); }} hitSlop={10} style={s.ctlBtn}>
              <Svg width={18} height={18} fill={Colors.text} viewBox="0 0 24 24"><Path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" /></Svg>
            </Pressable>
            <Pressable onPress={(e) => { e.stopPropagation(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); togglePlay(); }} hitSlop={10} style={s.ctlBtn}>
              {playing
                ? <Svg width={18} height={18} viewBox="0 0 24 24" fill={Colors.text}><Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></Svg>
                : <Svg width={18} height={18} viewBox="0 0 24 24" fill={Colors.text}><Path d="M8 5v14l11-7z" /></Svg>}
            </Pressable>
            <Pressable onPress={(e) => { e.stopPropagation(); onNext(); }} hitSlop={10} style={s.ctlBtn}>
              <Svg width={18} height={18} fill={Colors.text} viewBox="0 0 24 24"><Path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z" /></Svg>
            </Pressable>
          </View>
        </Pressable>
      </Animated.View>
    </PanGestureHandler>
  );
}

const s = StyleSheet.create({
  wrap:        { position: 'absolute', left: 0, right: 0, height: MINI_PLAYER_HEIGHT, overflow: 'hidden', borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  bgTint:      { backgroundColor: 'rgba(10,10,10,0.4)' },
  progressBg:  { position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,255,255,0.07)', zIndex: 2 },
  progressFill:{ height: 2, backgroundColor: Colors.accent },
  row:         { flex: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 4, gap: 12 },
  cover:       { width: 44, height: 44, borderRadius: 9, backgroundColor: Colors.elevated, flexShrink: 0 },
  info:        { flex: 1, minWidth: 0 },
  title:       { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  artist:      { color: Colors.text2, fontSize: Font.xs, marginTop: 2 },
  controls:    { flexDirection: 'row', alignItems: 'center' },
  ctlBtn:      { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
