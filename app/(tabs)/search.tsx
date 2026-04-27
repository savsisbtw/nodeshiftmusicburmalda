import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet, Pressable, Keyboard,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Colors, Font, Spacing, Radius, TAB_BAR_HEIGHT, MINI_PLAYER_HEIGHT } from '../../constants/theme';
import { searchTracks, Track, coverUrl } from '../../services/api';
import { usePlayer } from '../../store';

export default function SearchScreen() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const insets = useSafeAreaInsets();
  const { setQueue } = usePlayer();

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearched(false); return; }
    setLoading(true);
    setSearched(true);
    const res = await searchTracks(q.trim());
    setResults(res);
    setLoading(false);
  }, []);

  const playTrack = (index: number) => {
    Keyboard.dismiss();
    setQueue(results, index);
    usePlayer.getState().setExpanded(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={styles.title}>Поиск</Text>

      <View style={styles.inputWrap}>
        <TextInput
          style={styles.input}
          placeholder="Треки, исполнители..."
          placeholderTextColor={Colors.text3}
          value={query}
          onChangeText={q => { setQuery(q); doSearch(q); }}
          returnKeyType="search"
          onSubmitEditing={() => doSearch(query)}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {!searched && (
        <Animated.View entering={FadeIn} style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🎵</Text>
          <Text style={styles.emptyText}>Введите название трека{'\n'}или имя исполнителя</Text>
        </Animated.View>
      )}

      {searched && !loading && results.length === 0 && (
        <Animated.View entering={FadeIn} style={styles.emptyWrap}>
          <Text style={styles.emptyIcon}>🔍</Text>
          <Text style={styles.emptyText}>Ничего не найдено</Text>
        </Animated.View>
      )}

      <FlatList
        data={results}
        keyExtractor={t => String(t.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: Spacing.md,
          paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <SearchResult track={item} index={index} onPress={() => playTrack(index)} />
        )}
      />
    </View>
  );
}

function SearchResult({ track, index, onPress }: { track: Track; index: number; onPress: () => void }) {
  const { queue, index: qi } = usePlayer();
  const active = queue[qi]?.id === track.id;
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cover = coverUrl(track.cover_url);

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(250)} style={aStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={onPress}
        style={[styles.row, active && styles.rowActive]}
      >
        <Image
          source={cover ? { uri: cover } : require('../../assets/placeholder.png')}
          style={styles.cover}
          contentFit="cover"
          transition={200}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.trackTitle, active && { color: Colors.green }]} numberOfLines={1}>
            {track.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
        </View>
        <Text style={styles.dur}>{fmt(track.duration)}</Text>
      </Pressable>
    </Animated.View>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  title:     { color: Colors.text, fontSize: Font.xxl, fontWeight: '800', letterSpacing: -0.5, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, marginBottom: Spacing.md },
  inputWrap: { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  input:     { color: Colors.text, fontSize: Font.md, paddingVertical: 13 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  emptyIcon: { fontSize: 48, marginBottom: Spacing.md },
  emptyText: { color: Colors.text2, fontSize: Font.md, textAlign: 'center', lineHeight: 24 },
  row:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: Spacing.md, borderRadius: Radius.sm },
  rowActive: { backgroundColor: Colors.surface + '80' },
  cover:     { width: 48, height: 48, borderRadius: Radius.sm, backgroundColor: Colors.elevated },
  trackTitle:{ color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  artist:    { color: Colors.text2, fontSize: Font.sm, marginTop: 2 },
  dur:       { color: Colors.text3, fontSize: Font.xs },
});
