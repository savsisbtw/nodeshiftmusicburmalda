import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, Dimensions, RefreshControl } from 'react-native';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Font, Spacing, Radius, TAB_BAR_HEIGHT, MINI_PLAYER_HEIGHT } from '../../constants/theme';
import { getTracks, getAlbums, Track, Album, coverUrl } from '../../services/api';
import { usePlayer, useLikes } from '../../store';

const { width } = Dimensions.get('window');
const CARD_W    = (width - Spacing.md * 3) / 2;

export default function HomeScreen() {
  const [tracks, setTracks]   = useState<Track[]>([]);
  const [albums, setAlbums]   = useState<Album[]>([]);
  const [refresh, setRefresh] = useState(false);
  const insets = useSafeAreaInsets();
  const { setQueue } = usePlayer();
  const { toggleLike, isLiked } = useLikes();

  const load = useCallback(async () => {
    const [t, a] = await Promise.all([getTracks(), getAlbums()]);
    setTracks(t);
    setAlbums(a);
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefresh(true);
    await load();
    setRefresh(false);
  };

  const playTrack = (track: Track, list: Track[], idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQueue(list, idx);
    usePlayer.getState().setExpanded(true);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24 }]}
      refreshControl={<RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={Colors.text2} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(400)} style={styles.pageHeader}>
        <Text style={styles.pageTitle}>NodeShift Music</Text>
      </Animated.View>

      {/* Now playing strip (if track exists) */}
      <NowPlayingStrip />

      {/* Albums */}
      {albums.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.secTitle}>Альбомы</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {albums.map((a, i) => (
              <AlbumCard key={a.id} album={a} delay={i * 50} />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Tracks */}
      {tracks.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.secTitle}>Треки</Text>
          {tracks.map((t, i) => (
            <TrackRow
              key={t.id}
              track={t}
              index={i}
              liked={isLiked(t.id)}
              onPress={() => playTrack(t, tracks, i)}
              onLike={() => toggleLike(t.id)}
            />
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );
}

function NowPlayingStrip() {
  const { queue, index, playing, setExpanded } = usePlayer();
  const track = queue[index];
  if (!track) return null;
  const cover = coverUrl(track.cover_url);
  return (
    <Animated.View entering={FadeInDown.duration(300)} style={styles.npStrip}>
      {cover && <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />}
      <View style={[StyleSheet.absoluteFill, styles.npDim]} />
      <Pressable style={styles.npContent} onPress={() => setExpanded(true)}>
        {cover
          ? <Image source={{ uri: cover }} style={styles.npCover} contentFit="cover" />
          : <View style={[styles.npCover, { backgroundColor: Colors.elevated }]} />
        }
        <View style={styles.npInfo}>
          <Text style={styles.npLabel}>Сейчас играет</Text>
          <Text style={styles.npTitle} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.npArtist} numberOfLines={1}>{track.artist}</Text>
        </View>
        <View style={styles.npDot}>
          {playing
            ? <View style={styles.npEq}>{[1,2,3].map(i => <Animated.View key={i} style={[styles.npBar, { height: 4 + i * 4 }]} />)}</View>
            : <Svg width={16} height={16} viewBox="0 0 24 24" fill={Colors.text}><Path d="M8 5v14l11-7z" /></Svg>
          }
        </View>
      </Pressable>
    </Animated.View>
  );
}

function AlbumCard({ album, delay }: { album: Album; delay: number }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cover = coverUrl(album.cover_url);
  return (
    <Animated.View entering={FadeInDown.delay(delay)} style={style}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={styles.albumCard}
      >
        <Image
          source={cover ? { uri: cover } : require('../../assets/placeholder.png')}
          style={styles.albumCover}
          contentFit="cover"
          transition={300}
        />
        <Text style={styles.albumTitle} numberOfLines={1}>{album.title}</Text>
        <Text style={styles.albumArtist} numberOfLines={1}>{album.artist}</Text>
      </Pressable>
    </Animated.View>
  );
}

function TrackRow({ track, index, liked, onPress, onLike }: {
  track: Track; index: number; liked: boolean; onPress: () => void; onLike: () => void;
}) {
  const { queue, index: qi } = usePlayer();
  const active = queue[qi]?.id === track.id;
  const cover  = coverUrl(track.cover_url);

  return (
    <Pressable onPress={onPress} style={[styles.trackRow, active && styles.trackRowActive]}>
      <Text style={styles.trackNum}>{index + 1}</Text>
      <Image
        source={cover ? { uri: cover } : require('../../assets/placeholder.png')}
        style={styles.trackCover}
        contentFit="cover"
        transition={200}
      />
      <View style={styles.trackInfo}>
        <Text style={[styles.trackTitle, active && { color: Colors.accent }]} numberOfLines={1}>{track.title}</Text>
        <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
      </View>
      <Pressable onPress={onLike} hitSlop={12}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill={liked ? Colors.pink : 'none'}>
          <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={liked ? Colors.pink : Colors.text3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <Text style={styles.trackDur}>{fmt(track.duration)}</Text>
    </Pressable>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

const styles = StyleSheet.create({
  scroll:          { flex: 1, backgroundColor: Colors.bg },
  content:         { paddingHorizontal: Spacing.md },
  pageHeader:      { marginBottom: Spacing.md },
  pageTitle:       { color: Colors.text, fontSize: Font.xxl, fontWeight: '800', letterSpacing: -0.5 },
  section:         { marginBottom: Spacing.xl },
  secTitle:        { color: Colors.text, fontSize: Font.lg, fontWeight: '700', marginBottom: Spacing.md },
  hRow:            { gap: Spacing.md, paddingRight: Spacing.md },
  albumCard:       { width: CARD_W },
  albumCover:      { width: CARD_W, height: CARD_W, borderRadius: Radius.md, backgroundColor: Colors.elevated, marginBottom: Spacing.sm },
  albumTitle:      { color: Colors.text, fontSize: Font.sm, fontWeight: '600' },
  albumArtist:     { color: Colors.text2, fontSize: Font.xs, marginTop: 2 },
  trackRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: Spacing.sm, borderRadius: Radius.sm, gap: Spacing.sm },
  trackRowActive:  { backgroundColor: Colors.surface },
  trackNum:        { width: 24, color: Colors.text3, fontSize: Font.sm, textAlign: 'center' },
  trackCover:      { width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: Colors.elevated },
  trackInfo:       { flex: 1 },
  trackTitle:      { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  trackArtist:     { color: Colors.text2, fontSize: Font.sm, marginTop: 2 },
  trackDur:        { color: Colors.text3, fontSize: Font.xs },
  // Now playing strip
  npStrip:         { borderRadius: Radius.lg, overflow: 'hidden', marginBottom: Spacing.xl, height: 80 },
  npDim:           { backgroundColor: 'rgba(0,0,0,0.55)' },
  npContent:       { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  npCover:         { width: 52, height: 52, borderRadius: Radius.sm },
  npInfo:          { flex: 1 },
  npLabel:         { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '600', letterSpacing: 0.5, marginBottom: 2 },
  npTitle:         { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  npArtist:        { color: Colors.text2, fontSize: Font.xs, marginTop: 1 },
  npDot:           { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  npEq:            { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  npBar:           { width: 3, backgroundColor: Colors.accent, borderRadius: 2 },
});
