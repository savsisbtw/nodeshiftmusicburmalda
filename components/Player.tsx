import { useCallback, useEffect, type ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  interpolate, useAnimatedGestureHandler, runOnJS, FadeIn,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Polyline } from 'react-native-svg';
import { Colors, Font, Radius, Spacing } from '../constants/theme';
import { usePlayer } from '../store';
import { useAudio } from '../hooks/useAudio';
import { coverUrl } from '../services/api';

const { width } = Dimensions.get('window');
const COVER_SIZE = width - 64;

export default function Player() {
  const {
    queue, index, playing, progress, duration,
    repeat, shuffle, setExpanded, cycleRepeat, toggleShuffle,
  } = usePlayer();
  const { togglePlay, seek } = useAudio();
  const insets = useSafeAreaInsets();
  const track  = queue[index];

  const translateY = useSharedValue(0);
  const coverScale = useSharedValue(1);

  useEffect(() => {
    coverScale.value = withSpring(playing ? 1 : 0.88, { damping: 16, stiffness: 120 });
  }, [playing]);

  const gestureHandler = useAnimatedGestureHandler<any, { startY: number }>({
    onStart: (_, ctx) => { ctx.startY = translateY.value; },
    onActive: (e, ctx) => {
      if (e.translationY > 0) translateY.value = ctx.startY + e.translationY;
    },
    onEnd: (e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        runOnJS(close)();
      } else {
        translateY.value = withSpring(0, { damping: 20 });
      }
    },
  });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coverScale.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, 300], [1, 0]),
  }));

  const close = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(false);
  }, [setExpanded]);

  const onNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const ni = usePlayer.getState().nextTrack();
    usePlayer.getState().setIndex(ni);
  }, []);

  const onPrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (progress > 3) { seek(0); return; }
    const pi = usePlayer.getState().prevTrack();
    usePlayer.getState().setIndex(pi);
  }, [progress, seek]);

  const onPlay = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    togglePlay();
  }, [togglePlay]);

  if (!track) return null;

  const cover = coverUrl(track.cover_url);
  const pct   = duration > 0 ? progress / duration : 0;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, overlayStyle]} entering={FadeIn.duration(200)}>
      {/* Blurred background art */}
      <Image
        source={cover ? { uri: cover } : require('../assets/placeholder.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={60}
      />
      <View style={[StyleSheet.absoluteFill, styles.dim]} />

      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[
          styles.sheet, containerStyle,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
        ]}>
          {/* Handle */}
          <Pressable onPress={close} hitSlop={20} style={styles.handleWrap}>
            <View style={styles.handle} />
          </Pressable>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Сейчас играет</Text>
          </View>

          {/* Cover */}
          <View style={styles.coverWrap}>
            <Animated.View style={[styles.coverShadow, coverStyle]}>
              <Image
                source={cover ? { uri: cover } : require('../assets/placeholder.png')}
                style={styles.cover}
                contentFit="cover"
                transition={300}
              />
            </Animated.View>
          </View>

          {/* Info + like */}
          <View style={styles.infoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.trackTitle} numberOfLines={1}>{track.title}</Text>
              <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
            </View>
            <LikeButton />
          </View>

          {/* Progress bar */}
          <View style={styles.progressWrap}>
            <Slider
              style={{ width: '100%', height: 36 }}
              minimumValue={0}
              maximumValue={1}
              value={pct}
              minimumTrackTintColor={Colors.text}
              maximumTrackTintColor={Colors.text3}
              thumbTintColor={Colors.text}
              onSlidingComplete={(v) => seek(v * duration)}
            />
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{fmt(progress)}</Text>
              <Text style={styles.timeText}>{fmt(duration)}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={styles.controls}>
            <CtlBtn onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleShuffle(); }} active={shuffle}>
              <ShuffleIcon active={shuffle} />
            </CtlBtn>

            <CtlBtn onPress={onPrev}>
              <PrevIcon />
            </CtlBtn>

            <Pressable style={styles.playBtn} onPress={onPlay}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </Pressable>

            <CtlBtn onPress={onNext}>
              <NextIcon />
            </CtlBtn>

            <CtlBtn onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); cycleRepeat(); }} active={repeat > 0}>
              <RepeatIcon repeat={repeat} />
            </CtlBtn>
          </View>
        </Animated.View>
      </PanGestureHandler>
    </Animated.View>
  );
}

function CtlBtn({ onPress, active = false, children }: {
  onPress: () => void; active?: boolean; children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Pressable
        style={[styles.ctlBtn, active && styles.ctlBtnActive]}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.82, { damping: 12 }); }}
        onPressOut={() => { scale.value = withSpring(1,    { damping: 12 }); }}
        hitSlop={12}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function LikeButton() {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Pressable
        hitSlop={12}
        onPress={() => {
          scale.value = withSpring(1.35, { damping: 7 }, () => {
            scale.value = withSpring(1, { damping: 12 });
          });
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }}
      >
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
            stroke={Colors.text2} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
          />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

function PlayIcon() {
  return <Svg width={28} height={28} viewBox="0 0 24 24" fill={Colors.bg}><Path d="M8 5v14l11-7z" /></Svg>;
}
function PauseIcon() {
  return <Svg width={28} height={28} viewBox="0 0 24 24" fill={Colors.bg}><Path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></Svg>;
}
function PrevIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill={Colors.text}>
      <Path d="M19 20L9 12l10-8v16z" />
      <Path d="M5 19V5h2v14H5z" />
    </Svg>
  );
}
function NextIcon() {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24" fill={Colors.text}>
      <Path d="M5 4l10 8-10 8V4z" />
      <Path d="M19 5v14h-2V5h2z" />
    </Svg>
  );
}
function ShuffleIcon({ active }: { active: boolean }) {
  const c = active ? Colors.green : Colors.text2;
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Polyline points="16,3 21,3 21,8"    stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 20L21 3"                  stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="21,16 21,21 16,21"  stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 15l5.1 5.1M4 4l5 5"     stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function RepeatIcon({ repeat }: { repeat: 0 | 1 | 2 }) {
  const c = repeat > 0 ? Colors.green : Colors.text2;
  return (
    <View>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Polyline points="17,1 21,5 17,9"   stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M3 11V9a4 4 0 0 1 4-4h14"  stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="7,23 3,19 7,15"   stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M21 13v2a4 4 0 0 1-4 4H3"  stroke={c} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      {repeat === 2 && (
        <View style={styles.repeatBadge}>
          <Text style={styles.repeatBadgeText}>1</Text>
        </View>
      )}
    </View>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

const styles = StyleSheet.create({
  root:             { zIndex: 999 },
  dim:              { backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet:            { flex: 1, paddingHorizontal: Spacing.xl },
  handleWrap:       { alignItems: 'center', paddingBottom: 4 },
  handle:           { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  header:           { alignItems: 'center', marginBottom: Spacing.lg },
  headerTitle:      { color: Colors.text, fontSize: Font.sm, fontWeight: '600', letterSpacing: 0.5 },
  coverWrap:        { alignItems: 'center', marginBottom: Spacing.xl },
  coverShadow:      { shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.6, shadowRadius: 32 },
  cover:            { width: COVER_SIZE, height: COVER_SIZE, borderRadius: Radius.xl, backgroundColor: Colors.elevated },
  infoRow:          { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.md },
  trackTitle:       { color: Colors.text, fontSize: Font.xl, fontWeight: '700', letterSpacing: -0.3 },
  artist:           { color: 'rgba(255,255,255,0.5)', fontSize: Font.md, marginTop: 4 },
  progressWrap:     { marginBottom: Spacing.lg },
  timeRow:          { flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 },
  timeText:         { color: 'rgba(255,255,255,0.35)', fontSize: Font.xs },
  controls:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  ctlBtn:           { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full },
  ctlBtnActive:     { backgroundColor: 'rgba(255,255,255,0.1)' },
  playBtn:          { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.text, alignItems: 'center', justifyContent: 'center', shadowColor: '#fff', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 },
  repeatBadge:      { position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.green, alignItems: 'center', justifyContent: 'center' },
  repeatBadgeText:  { color: '#000', fontSize: 6, fontWeight: '800' },
});
