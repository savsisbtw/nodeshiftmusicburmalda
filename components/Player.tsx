import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, Dimensions, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring,
  useAnimatedGestureHandler, runOnJS, FadeIn, interpolate,
} from 'react-native-reanimated';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { Image } from 'expo-image';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Polyline, Line, Rect } from 'react-native-svg';
import { Colors, Font, Radius, Spacing } from '../constants/theme';
import { usePlayer, useLikes } from '../store';
import { useAudio } from '../hooks/useAudio';
import { coverUrl, fetchLyrics, parseLrc, LrcLine } from '../services/api';

const { width } = Dimensions.get('window');
const COVER = width - 48;

export default function Player() {
  const {
    queue, index, playing, progress, duration,
    repeat, shuffle, setExpanded, cycleRepeat, toggleShuffle,
  } = usePlayer();
  const { togglePlay, seek }   = useAudio();
  const { toggleLike, isLiked } = useLikes();
  const insets = useSafeAreaInsets();
  const track  = queue[index];

  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [lrcLines, setLrcLines]     = useState<LrcLine[]>([]);
  const [plainLyrics, setPlain]     = useState<string | null>(null);
  const [lyricsLoading, setLyricsLoading] = useState(false);
  const lyricsScrollRef = useRef<ScrollView>(null);
  const lineHeights = useRef<number[]>([]);

  const translateY  = useSharedValue(0);
  const coverScale  = useSharedValue(1);
  const lyrSheetY   = useSharedValue(500);

  useEffect(() => {
    coverScale.value = withSpring(playing ? 1 : 0.88, { damping: 16, stiffness: 120 });
  }, [playing]);

  useEffect(() => {
    setLrcLines([]);
    setPlain(null);
    setLyricsOpen(false);
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

  // Auto-scroll lyrics to current line
  const currentLineIdx = lrcLines.length > 0
    ? lrcLines.reduce((acc, line, i) => line.time <= progress ? i : acc, 0)
    : -1;

  useEffect(() => {
    if (!lyricsOpen || currentLineIdx < 0) return;
    const y = lineHeights.current.slice(0, currentLineIdx).reduce((s, h) => s + h, 0);
    lyricsScrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
  }, [currentLineIdx, lyricsOpen]);

  const gestureHandler = useAnimatedGestureHandler<any, { startY: number }>({
    onStart: (_, ctx) => { ctx.startY = translateY.value; },
    onActive: (e, ctx) => {
      if (e.translationY > 0) translateY.value = ctx.startY + e.translationY;
    },
    onEnd: (e) => {
      if (e.translationY > 100 || e.velocityY > 700) runOnJS(close)();
      else translateY.value = withSpring(0, { damping: 20 });
    },
  });

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const overlayOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [0, 300], [1, 0]),
  }));
  const coverStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coverScale.value }],
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

  const cover  = coverUrl(track.cover_url);
  const pct    = duration > 0 ? progress / duration : 0;
  const liked  = isLiked(track.id);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.root, overlayOpacity]} entering={FadeIn.duration(200)}>
      {/* Blurred album art background */}
      <Image
        source={cover ? { uri: cover } : require('../assets/placeholder.png')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        blurRadius={80}
      />
      <View style={[StyleSheet.absoluteFill, s.bgDim]} />
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />

      <PanGestureHandler onGestureEvent={gestureHandler}>
        <Animated.View style={[s.sheet, containerStyle, {
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 16,
        }]}>

          {/* Drag handle + top label */}
          <Pressable onPress={close} hitSlop={20} style={s.topBar}>
            <View style={s.handle} />
            <Text style={s.topLabel}>Сейчас играет</Text>
            <Pressable onPress={close} hitSlop={16} style={s.closeBtn}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.5)" strokeWidth={2} strokeLinecap="round" />
              </Svg>
            </Pressable>
          </Pressable>

          {/* Cover */}
          <View style={s.coverWrap}>
            <Animated.View style={[s.coverShadow, coverStyle]}>
              <Image
                source={cover ? { uri: cover } : require('../assets/placeholder.png')}
                style={s.cover}
                contentFit="cover"
                transition={300}
              />
            </Animated.View>
          </View>

          {/* Meta row */}
          <View style={s.metaRow}>
            <View style={s.metaText}>
              <Text style={s.trackTitle} numberOfLines={1}>{track.title}</Text>
              <Text style={s.artist} numberOfLines={1}>{track.artist}</Text>
            </View>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleLike(track.id); }}
              hitSlop={12}
            >
              <Svg width={22} height={22} viewBox="0 0 24 24" fill={liked ? Colors.pink : 'none'}>
                <Path
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                  stroke={liked ? Colors.pink : 'rgba(255,255,255,0.4)'}
                  strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"
                />
              </Svg>
            </Pressable>
          </View>

          {/* Seek bar */}
          <View style={s.seekWrap}>
            <Slider
              style={{ width: '100%', height: 32 }}
              minimumValue={0}
              maximumValue={1}
              value={pct}
              minimumTrackTintColor={Colors.text}
              maximumTrackTintColor="rgba(255,255,255,0.2)"
              thumbTintColor={Colors.text}
              onSlidingComplete={(v) => seek(v * duration)}
            />
            <View style={s.timeRow}>
              <Text style={s.timeText}>{fmt(progress)}</Text>
              <Text style={s.timeText}>{fmt(duration)}</Text>
            </View>
          </View>

          {/* Controls */}
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
            <Pressable style={s.playBtn} onPress={onPlay}>
              {playing
                ? <Svg width={26} height={26} viewBox="0 0 24 24" fill={Colors.bg}><Rect x={5} y={4} width={4} height={16} rx={1.5} fill={Colors.bg} /><Rect x={15} y={4} width={4} height={16} rx={1.5} fill={Colors.bg} /></Svg>
                : <Svg width={26} height={26} viewBox="0 0 24 24" fill={Colors.bg}><Path d="M7 4.5v15l13-7.5L7 4.5z" fill={Colors.bg} /></Svg>
              }
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

          {/* Bottom row: lyrics + speed */}
          <View style={s.bottomRow}>
            <Pressable style={s.lyrBtn} onPress={loadLyrics}>
              <Svg width={14} height={14} fill="none" stroke={lyricsOpen ? Colors.accent : 'rgba(255,255,255,0.4)'} strokeWidth={2} viewBox="0 0 24 24">
                <Line x1={3} y1={8} x2={21} y2={8} /><Line x1={3} y1={12} x2={21} y2={12} /><Line x1={3} y1={16} x2={15} y2={16} />
              </Svg>
              <Text style={[s.lyrBtnText, lyricsOpen && { color: Colors.accent }]}>
                {lyricsLoading ? 'Загрузка…' : 'Текст'}
              </Text>
            </Pressable>
          </View>

        </Animated.View>
      </PanGestureHandler>

      {/* Lyrics bottom sheet */}
      {lyricsOpen && (
        <View style={s.lyrSheet}>
          <Pressable style={s.lyrBg} onPress={() => setLyricsOpen(false)} />
          <BlurView intensity={40} tint="dark" style={s.lyrInner}>
            {/* Handle */}
            <Pressable onPress={() => setLyricsOpen(false)} style={s.lyrHandleBar}>
              <View style={s.lyrHandle} />
            </Pressable>
            {/* Mini header */}
            <View style={s.lyrHeader}>
              {cover
                ? <Image source={{ uri: cover }} style={s.lyrThumb} contentFit="cover" />
                : <View style={[s.lyrThumb, { backgroundColor: Colors.elevated }]} />
              }
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.lyrTrackTitle} numberOfLines={1}>{track.title}</Text>
                <Text style={s.lyrArtist} numberOfLines={1}>{track.artist}</Text>
              </View>
            </View>
            {/* Lyrics content */}
            <ScrollView
              ref={lyricsScrollRef}
              style={s.lyrScroll}
              contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 20 }}
              showsVerticalScrollIndicator={false}
            >
              {lrcLines.length > 0
                ? lrcLines.map((line, i) => (
                  <Text
                    key={i}
                    style={[s.lyrLine, i === currentLineIdx && s.lyrLineActive]}
                    onLayout={(e) => { lineHeights.current[i] = e.nativeEvent.layout.height; }}
                  >
                    {line.text}
                  </Text>
                ))
                : plainLyrics
                  ? <Text style={s.plainLyrics}>{plainLyrics}</Text>
                  : <Text style={s.lyrEmpty}>Текст не найден</Text>
              }
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
        onPressIn={() => { sc.value = withSpring(0.82, { damping: 12 }); }}
        onPressOut={() => { sc.value = withSpring(1, { damping: 12 }); }}
        hitSlop={12}
        style={[s.ctlBtn, active && s.ctlBtnActive]}
      >{children}</Pressable>
    </Animated.View>
  );
}

function ShuffleIcon({ active }: { active: boolean }) {
  const c = active ? Colors.accent : 'rgba(255,255,255,0.5)';
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Polyline points="16,3 21,3 21,8"   stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M4 20L21 3"                 stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Polyline points="21,16 21,21 16,21" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M15 15l5.1 5.1M4 4l5 5"    stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function RepeatIcon({ repeat }: { repeat: 0 | 1 | 2 }) {
  const c = repeat > 0 ? Colors.accent : 'rgba(255,255,255,0.5)';
  return (
    <View>
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Polyline points="17,1 21,5 17,9"  stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M3 11V9a4 4 0 0 1 4-4h14" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points="7,23 3,19 7,15"  stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M21 13v2a4 4 0 0 1-4 4H3" stroke={c} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      {repeat === 2 && (
        <View style={s.repBadge}><Text style={s.repBadgeText}>1</Text></View>
      )}
    </View>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

const s = StyleSheet.create({
  root:          { zIndex: 999 },
  bgDim:         { backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet:         { flex: 1, paddingHorizontal: 24 },
  topBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8 },
  handle:        { display: 'none' },
  topLabel:      { color: 'rgba(255,255,255,0.38)', fontSize: 11, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  coverWrap:     { alignItems: 'center', marginVertical: 20 },
  coverShadow:   { shadowColor: '#000', shadowOffset: { width: 0, height: 24 }, shadowOpacity: 0.7, shadowRadius: 32 },
  cover:         { width: COVER, height: COVER, borderRadius: Radius.xl, backgroundColor: Colors.elevated },
  metaRow:       { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  metaText:      { flex: 1 },
  trackTitle:    { color: Colors.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  artist:        { color: 'rgba(255,255,255,0.55)', fontSize: 17, marginTop: 4 },
  seekWrap:      { marginBottom: 8 },
  timeRow:       { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  timeText:      { color: 'rgba(255,255,255,0.35)', fontSize: Font.xs },
  controls:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 20 },
  ctlBtn:        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.full },
  ctlBtnActive:  { backgroundColor: 'rgba(255,255,255,0.1)' },
  playBtn:       { width: 60, height: 60, borderRadius: 30, backgroundColor: Colors.text, alignItems: 'center', justifyContent: 'center' },
  bottomRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20 },
  lyrBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radius.full },
  lyrBtnText:    { color: 'rgba(255,255,255,0.4)', fontSize: Font.xs, fontWeight: '600' },
  repBadge:      { position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  repBadgeText:  { color: '#000', fontSize: 6, fontWeight: '800' },
  // Lyrics sheet
  lyrSheet:      { position: 'absolute', inset: 0, bottom: 0, zIndex: 100, justifyContent: 'flex-end' },
  lyrBg:         { ...StyleSheet.absoluteFillObject },
  lyrInner:      { height: '70%', borderRadius: 20, overflow: 'hidden', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  lyrHandleBar:  { alignItems: 'center', paddingTop: 12, paddingBottom: 4 },
  lyrHandle:     { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  lyrHeader:     { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  lyrThumb:      { width: 40, height: 40, borderRadius: 8, flexShrink: 0 },
  lyrTrackTitle: { fontSize: 13, fontWeight: '600', color: '#fff' },
  lyrArtist:     { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  lyrScroll:     { flex: 1 },
  lyrLine:       { fontSize: 20, lineHeight: 32, color: 'rgba(255,255,255,0.28)', fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  lyrLineActive: { fontSize: 28, lineHeight: 42, color: '#fff', marginBottom: 10 },
  plainLyrics:   { fontSize: 15, lineHeight: 26, color: 'rgba(255,255,255,0.75)', textAlign: 'center' },
  lyrEmpty:      { color: 'rgba(255,255,255,0.35)', fontSize: 14, textAlign: 'center', marginTop: 40 },
});
