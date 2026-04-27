import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  Dimensions, RefreshControl,
} from 'react-native';
import Animated, {
  FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Colors, Font, Spacing, Radius, TAB_BAR_HEIGHT, MINI_PLAYER_HEIGHT } from '../../constants/theme';
import { getTracks, getAlbums, Track, Album, coverUrl } from '../../services/api';
import { usePlayer } from '../../store';

const { width } = Dimensions.get('window');
const CARD_W = width * 0.42;

export default function HomeScreen() {
  const [tracks, setTracks]   = useState<Track[]>([]);
  const [albums, setAlbums]   = useState<Album[]>([]);
  const [refresh, setRefresh] = useState(false);
  const insets = useSafeAreaInsets();
  const { setQueue, queue } = usePlayer();

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

  const playTrack = (track: Track, index: number) => {
    setQueue(tracks, index);
    usePlayer.getState().setExpanded(true);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.md, paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24 }
      ]}
      refreshControl={
        <RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={Colors.green} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <Animated.View entering={FadeIn.duration(500)}>
        <Text style={styles.greeting}>Добро пожаловать</Text>
        <Text style={styles.title}>NodeShift Music</Text>
      </Animated.View>

      {/* Albums row */}
      {albums.length > 0 && (
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Альбомы</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScroll}>
            {albums.map((a, i) => (
              <AlbumCard key={a.id} album={a} index={i}
                onPress={() => {/* open album */}} />
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Tracks list */}
      {tracks.length > 0 && (
        <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
          <Text style={styles.sectionTitle}>Треки</Text>
          {tracks.map((t, i) => (
            <TrackRow key={t.id} track={t} index={i} onPress={() => playTrack(t, i)} />
          ))}
        </Animated.View>
      )}
    </ScrollView>
  );
}

function AlbumCard({ album, index, onPress }: { album: Album; index: number; onPress: () => void }) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cover = coverUrl(album.cover_url);

  return (
    <Animated.View entering={FadeInDown.delay(index * 60)} style={style}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={onPress}
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

function TrackRow({ track, index, onPress }: { track: Track; index: number; onPress: () => void }) {
  const { queue, index: qi } = usePlayer();
  const isPlaying = queue[qi]?.id === track.id;
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cover = coverUrl(track.cover_url);

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(300)} style={style}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={onPress}
        style={[styles.trackRow, isPlaying && styles.trackRowActive]}
      >
        <Image
          source={cover ? { uri: cover } : require('../../assets/placeholder.png')}
          style={styles.trackCover}
          contentFit="cover"
          transition={200}
        />
        <View style={styles.trackInfo}>
          <Text style={[styles.trackTitle, isPlaying && { color: Colors.green }]} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.trackArtist} numberOfLines={1}>{track.artist}</Text>
        </View>
        <Text style={styles.trackDur}>{fmt(track.duration)}</Text>
      </Pressable>
    </Animated.View>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: Spacing.md },
  greeting: { color: Colors.text3, fontSize: Font.sm, fontWeight: '600', marginBottom: 4 },
  title:    { color: Colors.text, fontSize: Font.xxxl, fontWeight: '800', letterSpacing: -1, marginBottom: Spacing.xl },
  section:  { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.text, fontSize: Font.lg, fontWeight: '700', marginBottom: Spacing.md },
  hScroll:  { paddingRight: Spacing.md, gap: Spacing.md },
  albumCard: { width: CARD_W },
  albumCover: { width: CARD_W, height: CARD_W, borderRadius: Radius.md, marginBottom: Spacing.sm, backgroundColor: Colors.elevated },
  albumTitle:  { color: Colors.text, fontSize: Font.sm, fontWeight: '600' },
  albumArtist: { color: Colors.text2, fontSize: Font.xs, marginTop: 2 },
  trackRow:   { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.sm, borderRadius: Radius.md, gap: Spacing.md },
  trackRowActive: { backgroundColor: Colors.surface },
  trackCover: { width: 48, height: 48, borderRadius: Radius.sm, backgroundColor: Colors.elevated },
  trackInfo:  { flex: 1 },
  trackTitle: { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  trackArtist:{ color: Colors.text2, fontSize: Font.sm, marginTop: 2 },
  trackDur:   { color: Colors.text3, fontSize: Font.xs },
});
