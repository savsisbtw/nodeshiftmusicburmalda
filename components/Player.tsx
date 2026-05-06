import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions, ScrollView, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withDecay,
  useAnimatedGestureHandler, runOnJS, FadeIn, interpolate, Easing, withTiming,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Polyline, Line, Rect, Circle } from 'react-native-svg';
import { Colors, Font, Radius } from '../constants/theme';
import { usePlayer, useLikes } from '../store';
import { togglePlay, seekTo } from '../hooks/useAudio';
import { coverUrl, fetchLyrics, parseLrc, LrcLine } from '../services/api';

const { width, height } = Dimensions.get('window');
const COVER = width - 48;
const MIN_SWIPE_DISTANCE = 50;
const MAX_SWIPE_DISTANCE = height * 0.4;

export default function Player() {
  const {
    queue, index, playing, progress, duration,
    repeat, shuffle, setExpanded, cycleRepeat, toggleShuffle,
  } = usePlayer();
  const { toggleLike, isLiked } = useLikes();
  const insets = useSafeAreaInsets();
  const track  = queue[index];

  const [lyricsOpen, setLyricsOpen]         = useState(false);
  const [lrcLines, setLrcLines]             = useState<LrcLine[]>([]);
  const [plainLyrics, setPlain]             = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading]   = useState(false);
  const lyricsScrollRef = useRef<ScrollView>(null);
  const lineHeights     = useRef<number[]>([]);
  const gestureRef      = useRef<any>(null);

  const translateY = useSharedValue(0);
  const coverScale = useSharedValue(1);
  const coverRotate = useSharedValue(0);

  useEffect(() => {
    coverScale.value = withSpring(playing ? 1 : 0.88, { damping: 14, mass: 1, stiffness: 100 });
  }, [playing]);

  useEffect(() => {
    setLrcLines([]); setPlain(null); setLyricsOpen(false);
    translateY.value = 0;
  }, [track?.id]);

  const loadLyrics = useCallback(async () => {
    if (!track) return;
    if (lrcLines.length > 0 || plainLyrics) { setLyricsOpen(true); return; }
    setLyricsLoading(true);
    const data = await fetchLyrics(track.id);
    setLyricsLoading(false);
    if (data?.synced) setLrcLines(parseLrc(data.synced));
    else if (data?.plain) setPlain(data.plain);
    setLyricsOpen(true);
  }, [track, lrcLines.length, plainLyrics]);

  const currentLineIdx = lrcLines.length > 0
    ? lrcLines.reduce((acc, line, i) => line.time <= progress ? i : acc, 0)
    : -1;

  useEffect(() => {
    if (!lyricsOpen || currentLineIdx < 0) return;
    const y = lineHeights.current.slice(0, currentLineIdx).reduce((sum, h) => sum + h, 0);
    lyricsScrollRef.current?.scrollTo({ y: Math.max(0, y - 100), animated: true });
  }, [currentLineIdx, lyricsOpen]);

  const gestureHandler = useAnimatedGestureHandler<any, { startY: number, startX: number }>({
    onStart: (_, ctx) => {
      ctx.startY = translateY.value;
      ctx.startX = 0;
    },
    onActive: (e, ctx) => {
      try {
        // Only allow vertical swipe, prevent diagonal
        if (Math.abs(e.translationX) > Math.abs(e.translationY) * 0.5) return;
        
        if (e.translationY > 0) {
          const clamped = Math.min(e.translationY, MAX_SWIPE_DISTANCE);
          translateY.value = ctx.startY + clamped;
          coverRotate.value = withTiming(clamped / 100, { duration: 50, easing: Easing.linear });
        }
      } catch (err) {
        console.warn('Gesture error:', err);
      }
    },
    onEnd: (e) => {
      try {
        const shouldClose = e.translationY > MIN_SWIPE_DISTANCE || e.velocityY > 500;
        
        if (shouldClose) {
          translateY.value = withTiming(height, { 
            duration: 300, 
            easing: Easing.out(Easing.ease) 
          }, () => {
            runOnJS(close)();
          });
          coverRotate.value = withTiming(0, { duration: 300 });
        } else {
          translateY.value = withSpring(0, { 
            damping: 15, 
            mass: 1, 
            stiffness: 120 
          });
          coverRotate.value = withTiming(0, { duration: 200 });
        }
      } catch (err) {
        console.warn('Gesture end error:', err);
        translateY.value = withSpring(0, { damping: 15, mass: 1 });
      }
    },
  });

  const containerStyle = useAnimatedStyle(() => ({ 
    transform: [{ translateY: translateY.value }] 
  }));
  
  const overlayOpacity = useAnimatedStyle(() => ({ 
    opacity: interpolate(translateY.value, [0, MAX_SWIPE_DISTANCE], [1, 0.2]) 
  }));
  
  const coverStyle = useAnimatedStyle(() => ({ 
    transform: [
      { scale: coverScale.value },
      { rotateZ: `${coverRotate.value}deg` }
    ] 
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
    if (progress > 3) { seekTo(0); return; }
    const pi = usePlayer.getState().prevTrack();
    usePlayer.getState().setIndex(pi);
  }, [progress]);

  if (!track) return null;

  const cover = coverUrl(track.cover_url);
  const pct   = duration > 0 ? progress / duration : 0;
  const liked = isLiked(track.id);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.root, overlayOpacity]} entering={FadeIn.duration(200)}>
      {/* Blurred background with better gradient */}
      <Image source={cover ? { uri: cover } : require('../assets/placeholder.png')} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={100} />
      <View style={[StyleSheet.absoluteFill, s.bgDim]} />
      <BlurView intensity={25} tint="dark" style={StyleSheet.absoluteFill} />

      <PanGestureHandler ref={gestureRef} onGestureEvent={gestureHandler}>
        <Animated.View style={[s.sheet, containerStyle, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>

          {/* Top bar with better design */}
          <View style={s.topBar}>
            <Text style={s.topLabel}>Сейчас играет</Text>
            <Pressable onPress={close} hitSlop={20} style={s.closeBtn}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.6)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>

          {/* Cover with better shadow */}
          <View style={s.coverWrap}>
            <Animated.View style={[s.coverShadow, coverStyle]}>
              <Image source={cover ? { uri: cover } : require('../assets/placeholder.png')} style={s.cover} contentFit="cover" transition={300} />
            </Animated.View>
          </View>

          {/* Meta with better spacing */}
          <View style={s.metaRow}>
            <View style={s.metaText}>
              <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
              <Text style={s.artist} numberOfLines={1}>{track.artist}</Text>
            </View>
            <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleLike(track.id); }} hitSlop={16}>
              <Svg width={24} height={24} viewBox="0 0 24 24" fill={liked ? Colors.pink : 'none'}>
                <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={liked ? Colors.pink : 'rgba(255,255,255,0.5)'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </Pressable>
          </View>

          {/* Seek with gradient track */}
          <View style={s.seekWrap}>
            <View style={s.sliderContainer}>
              <Slider 
                style={{ flex: 1, height: 40 }} 
                minimumValue={0} 
                maximumValue={1} 
                value={pct} 
                minimumTrackTintColor={Colors.accent}
                maximumTrackTintColor="rgba(255,255,255,0.15)"
                thumbTintColor={Colors.text}
                onSlidingComplete={(v) => seekTo(v * duration)}
              />
            </View>
            <View style={s.timeRow}>
              <Text style={s.timeText}>{fmt(progress)}</Text>
              <Text style={s.timeText}>{fmt(duration - progress)}</Text>
            </View>
          </View>

          {/* Controls with better styling */}
          <View style={s.controls}>
            <CtlBtn onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleShuffle(); }} active={shuffle}>
              <ShuffleIcon active={shuffle} />
            </CtlBtn>
            <CtlBtn onPress={onPrev}>
              <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
                <Rect x={5} y={6} width={2.5} height={16} rx={1.2} fill={Colors.text} />
                <Path d="M22 6L9.5 14 22 22V6z" fill={Colors.text} />
              </Svg>
            </CtlBtn>
            <Pressable style={s.playBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); togglePlay(); }}>
              {playing
                ? <Svg width={28} height={28} viewBox="0 0 24 24"><Rect x={5} y={4} width={4} height={16} rx={1.5} fill={Colors.bg} /><Rect x={15} y={4} width={4} height={16} rx={1.5} fill={Colors.bg} /></Svg>
                : <Svg width={28} height={28} viewBox="0 0 24 24" fill={Colors.bg}><Path d="M7 4.5v15l13-7.5L7 4.5z" /></Svg>}
            </Pressable>
            <CtlBtn onPress={onNext}>
              <Svg width={28} height={28} viewBox="0 0 28 28" fill="none">
                <Rect x={20.5} y={6} width={2.5} height={16} rx={1.2} fill={Colors.text} />
                <Path d="M6 6l12.5 8L6 22V6z" fill={Colors.text} />
              </Svg>
            </CtlBtn>
            <CtlBtn onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); cycleRepeat(); }} active={repeat > 0}>
              <RepeatIcon repeat={repeat} />
            </CtlBtn>
          </View>

          {/* Lyrics button */}
          <View style={s.bottomRow}>
            <Pressable style={[s.lyrBtn, lyricsOpen && s.lyrBtnActive]} onPress={loadLyrics}>
              <Svg width={15} height={15} fill="none" stroke={lyricsOpen ? Colors.accent : 'rgba(255,255,255,0.5)'} strokeWidth={2} viewBox="0 0 24 24">
                <Line x1={3} y1={8} x2={21} y2={8} strokeLinecap="round" /><Line x1={3} y1={12} x2={21} y2={12} strokeLinecap="round" /><Line x1={3} y1={16} x2={15} y2={16} strokeLinecap="round" />
              </Svg>
              <Text style={[s.lyrBtnText, lyricsOpen && { color: Colors.accent }]}>
                {lyricsLoading ? 'Загрузка…' : 'Текст'}
              </Text>
            </Pressable>
          </View>

        </Animated.View>
      </PanGestureHandler>

      {/* Lyrics sheet with better design */}
      {lyricsOpen && (
        <View style={s.lyrSheet}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLyricsOpen(false)} />
          <BlurView intensity={50} tint="dark" style={s.lyrInner}>
            <Pressable onPress={() => setLyricsOpen(false)} style={s.lyrHandleBar}>
              <View style={s.lyrHandle} />
            </Pressable>
            <View style={s.lyrHeader}>
              {cover
                ? <Image source={{ uri: cover }} style={s.lyrThumb} contentFit="cover" />
                : <View style={[s.lyrThumb, { backgroundColor: Colors.elevated }]} />}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.lyrTrackTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={s.lyrArtist} numberOfLines={1}>{track.artist}</Text>
              </View>
            </View>
            <ScrollView ref={lyricsScrollRef} style={s.lyrScroll} contentContainerStyle={{ paddingVertical: 40, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} scrollEventThrottle={16}>
              {lrcLines.length > 0
                ? lrcLines.map((line, i) => (
                    <Animated.Text 
                      key={i} 
                      style={[
                        s.lyrLine, 
                        i === currentLineIdx && s.lyrLineActive,
                        i < currentLineIdx && s.lyrLinePassed
                      ]} 
                      onLayout={(e) => { lineHeights.current[i] = e.nativeEvent.layout.height; }}
                    >
                      {line.text}
                    </Animated.Text>
                  ))
                : plainLyrics
                  ? <Text style={s.plainLyrics}>{plainLyrics}</Text>
                  : <Text style={s.lyrEmpty}>Текст не найден</Text>}
            </ScrollView>
          </BlurView>
        </View>
      )}
    </Animated.View>
  );
}

function CtlBtn({ onPress, active = false, children }: { onPress: () => void; active?: boolean; children: React.ReactNode }) {
  const sc = useSharedValue(1);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Animated.View style={st}>
      <Pressable 
        onPress={onPress} 
        onPressIn={() => { sc.value = withSpring(0.75, { damping: 10, mass: 0.8 }); }} 
        onPressOut={() => { sc.value = withSpring(1, { damping: 10, mass: 0.8 }); }} 
        hitSlop={14} 
        style={[s.ctlBtn, active && s.ctlBtnActive]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

function ShuffleIcon({ active }: { active: boolean }) {
  const c = active ? Colors.accent : 'rgba(255,255,255,0.6)';
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Polyline points="16,3 21,3 21,8"   stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 20L21 3"                  stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="21,16 21,21 16,21" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 15l5.1 5.1M4 4l5 5"     stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RepeatIcon({ repeat }: { repeat: 0 | 1 | 2 }) {
  const c = repeat > 0 ? Colors.accent : 'rgba(255,255,255,0.6)';
  return (
    <View>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Polyline points="17,1 21,5 17,9"  stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="7,23 3,19 7,15"  stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={c} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      {repeat === 2 && <View style={s.repBadge}><Text style={s.repBadgeText}>1</Text></View>}
    </View>
  );
}

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

const s = StyleSheet.create({
  root:            { zIndex: 999 },
  bgDim:           { backgroundColor: 'rgba(0,0,0,0.7)' },
  sheet:           { flex: 1, paddingHorizontal: 24 },
  topBar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 8 },
  topLabel:        { color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', letterSpacing: 1.3, textTransform: 'uppercase' },
  closeBtn:        { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  coverWrap:       { alignItems: 'center', marginVertical: 24, marginBottom: 32 },
  coverShadow:     { shadowColor: '#000', shadowOffset: { width: 0, height: 28 }, shadowOpacity: 0.8, shadowRadius: 40 },
  cover:           { width: COVER, height: COVER, borderRadius: Radius.xl, backgroundColor: Colors.elevated, overflow: 'hidden' },
  metaRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginBottom: 16 },
  metaText:        { flex: 1 },
  trackTitle:      { color: Colors.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 30 },
  artist:          { color: 'rgba(255,255,255,0.6)', fontSize: 16, marginTop: 6, fontWeight: '500' },
  seekWrap:        { marginBottom: 12 },
  sliderContainer: { height: 40, justifyContent: 'center' },
  timeRow:         { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  timeText:        { color: 'rgba(255,255,255,0.4)', fontSize: Font.xs, fontWeight: '500' },
  controls:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 24, marginTop: 16 },
  ctlBtn:          { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 },
  ctlBtnActive:    { backgroundColor: 'rgba(255,255,255,0.08)' },
  playBtn:         { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.text, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12 },
  bottomRow:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  lyrBtn:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  lyrBtnActive:    { backgroundColor: `${Colors.accent}15`, borderColor: `${Colors.accent}40` },
  lyrBtnText:      { color: 'rgba(255,255,255,0.5)', fontSize: Font.sm, fontWeight: '600' },
  repBadge:        { position: 'absolute', top: -4, right: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center', shadowColor: Colors.accent, shadowOpacity: 0.5, shadowRadius: 4 },
  repBadgeText:    { color: '#000', fontSize: 6, fontWeight: '900' },
  
  // Lyrics sheet
  lyrSheet:        { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, justifyContent: 'flex-end' },
  lyrInner:        { height: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  lyrHandleBar:    { alignItems: 'center', paddingTop: 14, paddingBottom: 8 },
  lyrHandle:       { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)' },
  lyrHeader:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  lyrThumb:        { width: 44, height: 44, borderRadius: 10, flexShrink: 0, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6 },
  lyrTrackTitle:   { fontSize: 14, fontWeight: '700', color: '#fff' },
  lyrArtist:       { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  lyrScroll:       { flex: 1 },
  lyrLine:         { fontSize: 18, lineHeight: 30, color: 'rgba(255,255,255,0.25)', fontWeight: '600', marginBottom: 12, textAlign: 'center' },
  lyrLineActive:   { fontSize: 32, lineHeight: 44, color: Colors.accent, marginBottom: 16, fontWeight: '800' },
  lyrLinePassed:   { color: 'rgba(255,255,255,0.35)' },
  plainLyrics:     { fontSize: 16, lineHeight: 28, color: 'rgba(255,255,255,0.75)', textAlign: 'center', fontWeight: '500' },
  lyrEmpty:        { color: 'rgba(255,255,255,0.38)', fontSize: 15, textAlign: 'center', marginTop: 60, fontWeight: '500' },
});
