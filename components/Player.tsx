import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions,
  ScrollView, Platform, StatusBar, Alert,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  useAnimatedGestureHandler, runOnJS, interpolate, Extrapolate,
  Easing, cancelAnimation,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import Svg, { Path, Rect, Polyline, Circle } from 'react-native-svg';
import { Colors, Font, Radius } from '../constants/theme';
import { usePlayer, useLikes } from '../store';
import { togglePlay, seekTo } from '../hooks/useAudio';
import { coverUrl, fetchLyrics, parseLrc, LrcLine } from '../services/api';
import { useDynamicColor, useNextTrackPreload } from '../hooks/usePlayerFeatures';
import { useShakeToShuffle } from '../hooks/useShakeToShuffle';
import ShareTrackModal from './ShareTrackModal';

const { width, height } = Dimensions.get('window');
const COVER_SIZE = width - 56;
const DISMISS_THRESHOLD = 120;
const DISMISS_VELOCITY = 800;

export default function Player() {
  const {
    queue, index, playing, progress, duration,
    repeat, shuffle, setExpanded, cycleRepeat, toggleShuffle,
  } = usePlayer();
  const { toggleLike, isLiked } = useLikes();
  const insets = useSafeAreaInsets();
  const track = queue[index];

  const [lyricsMode, setLyricsMode] = useState(false);
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
  const [plainLyrics, setPlain] = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const lyricsScrollRef = useRef<ScrollView>(null);
  const lineHeights = useRef<number[]>([]);
  const panRef = useRef<any>(null);
  const coverPanRef = useRef<any>(null);

  // Shared values
  const translateY = useSharedValue(0);
  const coverScale = useSharedValue(playing ? 1 : 0.875);
  const coverTranslateX = useSharedValue(0);
  const lyricsOpacity = useSharedValue(0);
  const playerOpacity = useSharedValue(1);

  // Dynamic color from cover
  const cover = track ? coverUrl(track.cover_url) : null;
  const dynColor = useDynamicColor(cover);

  // Shake → shuffle
  const onShake = useCallback(() => {
    try {
      if (!shuffle) toggleShuffle();
      const state = usePlayer.getState();
      if (state.nextTrack && state.setIndex) {
        state.setIndex(state.nextTrack());
      }
    } catch {}
  }, [shuffle, toggleShuffle]);
  useShakeToShuffle(onShake);

  // Preload next track 30s before end
  useNextTrackPreload();

  // Cover scale on play/pause
  useEffect(() => {
    coverScale.value = withSpring(playing ? 1 : 0.875, {
      damping: 18, mass: 1, stiffness: 120,
    });
  }, [playing]);

  // Lyrics mode transition
  useEffect(() => {
    if (lyricsMode) {
      lyricsOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
      playerOpacity.value = withTiming(0, { duration: 250 });
    } else {
      lyricsOpacity.value = withTiming(0, { duration: 250 });
      playerOpacity.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) });
    }
  }, [lyricsMode]);

  // Reset on track change
  useEffect(() => {
    setLrcLines([]); setPlain(null); setLyricsMode(false);
    translateY.value = 0;
    coverScale.value = withSpring(1, { damping: 18, stiffness: 120 });
  }, [track?.id]);

  // Auto-scroll lyrics
  const currentLineIdx = lrcLines.length > 0
    ? lrcLines.reduce((acc, line, i) => line.time <= progress ? i : acc, 0)
    : -1;

  useEffect(() => {
    if (!lyricsMode || currentLineIdx < 1) return;
    const y = lineHeights.current.slice(0, currentLineIdx - 1).reduce((s, h) => s + h, 0);
    lyricsScrollRef.current?.scrollTo({ y, animated: true });
  }, [currentLineIdx, lyricsMode]);

  const loadLyrics = useCallback(async () => {
    if (!track) return;
    if (lrcLines.length > 0 || plainLyrics) { setLyricsMode(true); return; }
    setLyricsLoading(true);
    try {
      const data = await fetchLyrics(track.id);
      if (data?.synced) setLrcLines(parseLrc(data.synced));
      else if (data?.plain) setPlain(data.plain);
    } catch {}
    setLyricsLoading(false);
    setLyricsMode(true);
  }, [track, lrcLines.length, plainLyrics]);

  const close = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpanded(false);
    translateY.value = 0;
  }, [setExpanded]);

  // Gesture handler - fixed to prevent crashes
  const gestureHandler = useAnimatedGestureHandler<any, { start: number }>({
    onStart: (_, ctx) => {
      cancelAnimation(translateY);
      ctx.start = translateY.value;
    },
    onActive: (e, ctx) => {
      const dy = e.translationY;
      if (dy <= 0) return;
      // Rubber band resistance
      const resistance = 1 - Math.min(dy / (height * 0.9), 0.85);
      translateY.value = ctx.start + dy * resistance;
    },
    onEnd: (e) => {
      const shouldDismiss =
        e.translationY > DISMISS_THRESHOLD || e.velocityY > DISMISS_VELOCITY;
      if (shouldDismiss) {
        translateY.value = withTiming(
          height,
          { duration: 380, easing: Easing.bezier(0.25, 0.46, 0.45, 0.94) },
          (done) => { if (done) runOnJS(close)(); }
        );
      } else {
        translateY.value = withSpring(0, {
          damping: 26, mass: 1, stiffness: 200, overshootClamping: false,
        });
      }
    },
    onFail: () => {
      translateY.value = withSpring(0, { damping: 26, stiffness: 200 });
    },
    onCancel: () => {
      translateY.value = withSpring(0, { damping: 26, stiffness: 200 });
    },
  });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, height * 0.5], [1, 0], Extrapolate.CLAMP),
  }));

  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coverScale.value }, { translateX: coverTranslateX.value }],
  }));

  const lyricsStyle = useAnimatedStyle(() => ({
    opacity: lyricsOpacity.value,
    pointerEvents: lyricsOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  const playerControlsStyle = useAnimatedStyle(() => ({
    opacity: playerOpacity.value,
    pointerEvents: playerOpacity.value > 0.5 ? 'auto' : 'none',
  }));

  // onNext/onPrev MUST be defined BEFORE coverGesture (no hoisting for useCallback)
  const onNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      const ni = usePlayer.getState().nextTrack();
      usePlayer.getState().setIndex(ni);
    } catch {}
  }, []);

  const onPrev = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      if (progress > 3) { seekTo(0); return; }
      const pi = usePlayer.getState().prevTrack();
      usePlayer.getState().setIndex(pi);
    } catch {}
  }, [progress]);

  const onCopyTitle = useCallback(() => {
    try {
      Clipboard.setStringAsync(`${track?.artist} — ${track?.title}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch {}
  }, [track]);

  // Horizontal swipe on cover → next/prev track
  const coverGesture = useAnimatedGestureHandler<any, { startX: number }>({
    onStart: (_, ctx) => { ctx.startX = coverTranslateX.value; },
    onActive: (e) => {
      if (Math.abs(e.translationY) > Math.abs(e.translationX) * 1.5) return;
      coverTranslateX.value = e.translationX * 0.4;
    },
    onEnd: (e) => {
      const THRESH = 60;
      if (e.translationX < -THRESH) {
        coverTranslateX.value = withTiming(-width, { duration: 220 }, () => {
          runOnJS(onNext)();
          coverTranslateX.value = width;
          coverTranslateX.value = withSpring(0, { damping: 20, stiffness: 180 });
        });
      } else if (e.translationX > THRESH) {
        coverTranslateX.value = withTiming(width, { duration: 220 }, () => {
          runOnJS(onPrev)();
          coverTranslateX.value = -width;
          coverTranslateX.value = withSpring(0, { damping: 20, stiffness: 180 });
        });
      } else {
        coverTranslateX.value = withSpring(0, { damping: 20, stiffness: 220 });
      }
    },
    onFail: () => { coverTranslateX.value = withSpring(0, { damping: 20 }); },
    onCancel: () => { coverTranslateX.value = withSpring(0, { damping: 20 }); },
  });

  if (!track) return null;

  // cover is already declared above via dynColor
  const pct = duration > 0 ? progress / duration : 0;
  const liked = isLiked(track.id);
  const ext = (track.filename?.split('.').pop() || 'MP3').toUpperCase();

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.root, overlayStyle]}>
      <StatusBar barStyle="light-content" />

      {/* Blurred background */}
      {cover ? (
        <Image
          source={{ uri: cover }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          blurRadius={80}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a1a' }]} />
      )}
      {/* Dynamic color background overlay */}
      <View style={[StyleSheet.absoluteFill, s.bgDim]} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: dynColor, opacity: 0.35 }]} />
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

      <PanGestureHandler
        ref={panRef}
        onGestureEvent={gestureHandler}
        activeOffsetY={[0, 15]}
        failOffsetY={[-15, 0]}
        failOffsetX={[-20, 20]}
      >
        <Animated.View style={[s.sheet, containerStyle, {
          paddingTop: insets.top + 12,
          paddingBottom: Math.max(insets.bottom, 20) + 8,
        }]}>

          {/* Handle bar */}
          <View style={s.handleBar}>
            <View style={s.handle} />
          </View>

          {/* Header */}
          <View style={s.header}>
            <Pressable onPress={close} hitSlop={20} style={s.headerBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M19 12H5M12 19l-7-7 7-7" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <View style={{ alignItems: 'center' }}>
              <Text style={s.headerLabel}>Воспроизведение</Text>
              <Text style={s.headerSub} numberOfLines={1}>{track.album || 'Треки'}</Text>
            </View>
            <Pressable hitSlop={20} style={s.headerBtn}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={5} r={1.5} fill="rgba(255,255,255,0.7)" />
                <Circle cx={12} cy={12} r={1.5} fill="rgba(255,255,255,0.7)" />
                <Circle cx={12} cy={19} r={1.5} fill="rgba(255,255,255,0.7)" />
              </Svg>
            </Pressable>
          </View>

          {/* Cover / Lyrics toggle area */}
          <View style={s.mainArea}>
            {/* Cover with horizontal swipe */}
            <Animated.View style={[s.coverWrap, playerControlsStyle]}>
              <PanGestureHandler
                ref={coverPanRef}
                onGestureEvent={coverGesture}
                activeOffsetX={[-12, 12]}
                failOffsetY={[-20, 20]}
              >
                <Animated.View style={[s.coverShadow, coverStyle]}>
                  <Pressable onPress={() => setLyricsMode(true)} onLongPress={onCopyTitle} delayLongPress={600}>
                    <Image
                      source={cover ? { uri: cover } : require('../assets/placeholder.png')}
                      style={s.cover}
                      contentFit="cover"
                      transition={300}
                    />
                  </Pressable>
                </Animated.View>
              </PanGestureHandler>
            </Animated.View>

            {/* Lyrics overlay */}
            <Animated.View style={[StyleSheet.absoluteFill, s.lyricsOverlay, lyricsStyle]}>
              <Pressable style={s.lyricsCloseHint} onPress={() => setLyricsMode(false)}>
                <Text style={s.lyricsCloseText}>Закрыть текст</Text>
              </Pressable>
              <ScrollView
                ref={lyricsScrollRef}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={s.lyricsContent}
                scrollEventThrottle={16}
              >
                {lrcLines.length > 0
                  ? lrcLines.map((line, i) => (
                    <LyricLine
                      key={i}
                      text={line.text}
                      isActive={i === currentLineIdx}
                      isPast={i < currentLineIdx}
                      onLayout={(h) => { lineHeights.current[i] = h; }}
                    />
                  ))
                  : plainLyrics
                    ? <Text style={s.plainLyrics}>{plainLyrics}</Text>
                    : <Text style={s.lyrEmpty}>Текст недоступен</Text>
                }
                <View style={{ height: 100 }} />
              </ScrollView>
            </Animated.View>
          </View>

          {/* Meta + like + share */}
          <View style={s.meta}>
            <View style={s.metaInfo}>
              <Pressable onLongPress={onCopyTitle} delayLongPress={400}>
                <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
              </Pressable>
              <Text style={s.artist} numberOfLines={1}>{track.artist}</Text>
            </View>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShareOpen(true); }}
              hitSlop={16} style={s.likeBtn}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke="rgba(255,255,255,0.6)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleLike(track.id); }}
              hitSlop={16} style={s.likeBtn}
            >
              <Svg width={26} height={26} viewBox="0 0 24 24" fill={liked ? Colors.pink : 'none'}>
                <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={liked ? Colors.pink : 'rgba(255,255,255,0.6)'} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>

          {/* Format badge */}
          <View style={s.formatRow}>
            <View style={s.formatBadge}>
              <Text style={s.formatText}>{ext}</Text>
            </View>
          </View>

          {/* Seeker */}
          <View style={s.seekWrap}>
            <Slider
              style={s.slider}
              minimumValue={0}
              maximumValue={1}
              value={isSeeking ? undefined : pct}
              minimumTrackTintColor={Colors.text}
              maximumTrackTintColor="rgba(255,255,255,0.15)"
              thumbTintColor={Colors.text}
              onSlidingStart={() => setIsSeeking(true)}
              onSlidingComplete={(v) => { setIsSeeking(false); seekTo(v * duration); }}
            />
            <View style={s.timeRow}>
              <Text style={s.timeText}>{fmt(progress)}</Text>
              <Text style={s.timeText}>-{fmt(duration - progress)}</Text>
            </View>
          </View>

          {/* Controls */}
          <View style={s.controls}>
            <IconBtn onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleShuffle(); }} active={shuffle}>
              <ShuffleIcon active={shuffle} />
            </IconBtn>
            <IconBtn onPress={onPrev} scale={0.85}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill={Colors.text}>
                <Path d="M19 20L9 12l10-8v16zM5 4h2v16H5z" />
              </Svg>
            </IconBtn>
            <Pressable
              style={s.playBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); togglePlay(); }}
            >
              {playing
                ? <Svg width={30} height={30} viewBox="0 0 24 24" fill={Colors.bg}>
                    <Rect x={5} y={4} width={4} height={16} rx={1.5} fill={Colors.bg} />
                    <Rect x={15} y={4} width={4} height={16} rx={1.5} fill={Colors.bg} />
                  </Svg>
                : <Svg width={30} height={30} viewBox="0 0 24 24" fill={Colors.bg}>
                    <Path d="M8 5v14l11-7z" />
                  </Svg>
              }
            </Pressable>
            <IconBtn onPress={onNext} scale={0.85}>
              <Svg width={32} height={32} viewBox="0 0 24 24" fill={Colors.text}>
                <Path d="M5 4l10 8-10 8V4zM19 4h-2v16h2z" />
              </Svg>
            </IconBtn>
            <IconBtn onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); cycleRepeat(); }} active={repeat > 0}>
              <RepeatIcon repeat={repeat} />
            </IconBtn>
          </View>

          {/* Bottom row */}
          <View style={s.bottomRow}>
            <Pressable
              style={[s.lyrBtn, !!(lyricsMode || lrcLines.length > 0 || plainLyrics) && s.lyrBtnActive]}
              onPress={loadLyrics}
            >
              <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
                <Path d="M3 8h18M3 12h18M3 16h12" stroke={lyricsMode ? Colors.accent : 'rgba(255,255,255,0.5)'} strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <Text style={[s.lyrBtnText, lyricsMode && { color: Colors.accent }]}>
                {lyricsLoading ? 'Загрузка...' : 'Текст песни'}
              </Text>
            </Pressable>
          </View>

        </Animated.View>
      </PanGestureHandler>

      {/* Share modal */}
      <ShareTrackModal
        track={track}
        progress={progress}
        visible={shareOpen}
        onClose={() => setShareOpen(false)}
      />
    </Animated.View>
  );
}

// Animated lyric line - Apple Music style
function LyricLine({ text, isActive, isPast, onLayout }: {
  text: string; isActive: boolean; isPast: boolean; onLayout: (h: number) => void;
}) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(isPast ? 0.4 : isActive ? 1 : 0.3);
  const fontSize = useSharedValue(isActive ? 32 : 22);

  useEffect(() => {
    opacity.value = withTiming(isActive ? 1 : isPast ? 0.45 : 0.28, { duration: 350 });
    scale.value = withSpring(isActive ? 1 : 0.92, { damping: 18, stiffness: 180 });
  }, [isActive, isPast]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.Text
      style={[s.lyrLine, style, isActive && s.lyrLineActive, isPast && s.lyrLinePast]}
      onLayout={(e) => onLayout(e.nativeEvent.layout.height)}
    >
      {text}
    </Animated.Text>
  );
}

function IconBtn({ onPress, active = false, scale = 0.8, children }: {
  onPress: () => void; active?: boolean; scale?: number; children: React.ReactNode;
}) {
  const sc = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Animated.View style={st}>
      <Pressable
        onPress={onPress}
        onPressIn={() => { sc.value = withSpring(scale, { damping: 10, mass: 0.6 }); }}
        onPressOut={() => { sc.value = withSpring(1, { damping: 10, mass: 0.6 }); }}
        hitSlop={16}
        style={[s.iconBtn, active && s.iconBtnActive]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function ShuffleIcon({ active }: { active: boolean }) {
  const c = active ? Colors.accent : 'rgba(255,255,255,0.65)';
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Polyline points="16,3 21,3 21,8" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 20L21 3" stroke={c} strokeWidth={2} strokeLinecap="round" />
      <Polyline points="21,16 21,21 16,21" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 15l5.1 5.1M4 4l5 5" stroke={c} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function RepeatIcon({ repeat }: { repeat: 0 | 1 | 2 }) {
  const c = repeat > 0 ? Colors.accent : 'rgba(255,255,255,0.65)';
  return (
    <View>
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
        <Polyline points="17,1 21,5 17,9" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={c} strokeWidth={2} strokeLinecap="round" />
        <Polyline points="7,23 3,19 7,15" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={c} strokeWidth={2} strokeLinecap="round" />
      </Svg>
      {repeat === 2 && (
        <View style={s.repBadge}><Text style={s.repBadgeText}>1</Text></View>
      )}
    </View>
  );
}

function fmt(sec: number) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const s = StyleSheet.create({
  root:           { zIndex: 999 },
  bgDim:          { backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet:          { flex: 1, paddingHorizontal: 28 },
  handleBar:      { alignItems: 'center', paddingBottom: 8 },
  handle:         { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerBtn:      { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerLabel:    { color: Colors.text, fontSize: 13, fontWeight: '700', letterSpacing: 0.2 },
  headerSub:      { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 },
  mainArea:       { flex: 1, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  coverWrap:      { alignItems: 'center', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center' },
  coverShadow:    { shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.75, shadowRadius: 36 },
  cover:          { width: COVER_SIZE, height: COVER_SIZE, borderRadius: 16, backgroundColor: Colors.elevated },
  lyricsOverlay:  { justifyContent: 'flex-start', paddingTop: 16 },
  lyricsCloseHint:{ alignItems: 'center', paddingVertical: 8, marginBottom: 8 },
  lyricsCloseText:{ color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: '600' },
  lyricsContent:  { paddingHorizontal: 8, paddingBottom: 40 },
  lyrLine:        { fontSize: 22, fontWeight: '700', color: 'rgba(255,255,255,0.28)', lineHeight: 34, marginBottom: 8, textAlign: 'left' },
  lyrLineActive:  { fontSize: 28, color: '#ffffff', lineHeight: 40 },
  lyrLinePast:    { color: 'rgba(255,255,255,0.45)' },
  plainLyrics:    { fontSize: 17, lineHeight: 28, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  lyrEmpty:       { color: 'rgba(255,255,255,0.4)', fontSize: 15, textAlign: 'center', marginTop: 60, fontWeight: '500' },
  meta:           { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 4, gap: 12 },
  metaInfo:       { flex: 1 },
  trackTitle:     { color: Colors.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  artist:         { color: 'rgba(255,255,255,0.55)', fontSize: 16, fontWeight: '500', marginTop: 4 },
  likeBtn:        { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  formatRow:      { flexDirection: 'row', marginBottom: 4 },
  formatBadge:    { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  formatText:     { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  seekWrap:       { marginBottom: 8 },
  slider:         { width: '100%', height: 44 },
  timeRow:        { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  timeText:       { color: 'rgba(255,255,255,0.4)', fontSize: 12, fontWeight: '500' },
  controls:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  iconBtn:        { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  iconBtnActive:  { backgroundColor: 'rgba(255,255,255,0.1)' },
  playBtn:        {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.text, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16,
  },
  bottomRow:      { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
  lyrBtn:         {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  lyrBtnActive:   { borderColor: `${Colors.accent}50`, backgroundColor: `${Colors.accent}18` },
  lyrBtnText:     { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600' },
  repBadge:       {
    position: 'absolute', top: -3, right: -5, width: 11, height: 11,
    borderRadius: 6, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  repBadgeText:   { color: '#000', fontSize: 6, fontWeight: '900' },
});
