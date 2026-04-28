import { useState, useCallback } from 'react';
import { View, Text, TextInput, FlatList, StyleSheet, Pressable, Keyboard } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Font, Spacing, Radius, TAB_BAR_HEIGHT, MINI_PLAYER_HEIGHT } from '../../constants/theme';
import { searchTracks, Track, coverUrl } from '../../services/api';
import { usePlayer, useLikes } from '../../store';

export default function SearchScreen() {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const insets = useSafeAreaInsets();
  const { setQueue } = usePlayer();
  const { toggleLike, isLiked } = useLikes();

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
          <Text style={styles.emptyText}>Введите название трека или исполнителя</Text>
        </Animated.View>
      )}

      {searched && !loading && results.length === 0 && (
        <Animated.View entering={FadeIn} style={styles.emptyWrap}>
          <Text style={styles.emptyText}>Ничего не найдено</Text>
        </Animated.View>
      )}

      <FlatList
        data={results}
        keyExtractor={t => String(t.id)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 30).duration(250)}>
            <Pressable
              onPress={() => playTrack(index)}
              style={[styles.row, usePlayer.getState().queue[usePlayer.getState().index]?.id === item.id && styles.rowActive]}
            >
              {(() => {
                const cover = coverUrl(item.cover_url);
                const liked = isLiked(item.id);
                const active = usePlayer.getState().queue[usePlayer.getState().index]?.id === item.id;
                return (
                  <>
                    <Image
                      source={cover ? { uri: cover } : require('../../assets/placeholder.png')}
                      style={styles.cover}
                      contentFit="cover"
                      transition={200}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.trackTitle, active && { color: Colors.accent }]} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.artist} numberOfLines={1}>{item.artist}</Text>
                    </View>
                    <Pressable onPress={() => toggleLike(item.id)} hitSlop={12}>
                      <Svg width={16} height={16} viewBox="0 0 24 24" fill={liked ? Colors.pink : 'none'}>
                        <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={liked ? Colors.pink : Colors.text3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                      </Svg>
                    </Pressable>
                    <Text style={styles.dur}>{fmt(item.duration)}</Text>
                  </>
                );
              })()}
            </Pressable>
          </Animated.View>
        )}
      />
    </View>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: Colors.bg },
  title:      { color: Colors.text, fontSize: Font.xxl, fontWeight: '800', letterSpacing: -0.5, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, marginBottom: Spacing.md },
  inputWrap:  { marginHorizontal: Spacing.md, marginBottom: Spacing.md, backgroundColor: Colors.surface, borderRadius: Radius.md, paddingHorizontal: Spacing.md },
  input:      { color: Colors.text, fontSize: Font.md, paddingVertical: 12 },
  emptyWrap:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  emptyText:  { color: Colors.text3, fontSize: Font.sm, textAlign: 'center' },
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: Spacing.md, borderRadius: Radius.sm },
  rowActive:  { backgroundColor: Colors.surface },
  cover:      { width: 48, height: 48, borderRadius: Radius.sm, backgroundColor: Colors.elevated },
  trackTitle: { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  artist:     { color: Colors.text2, fontSize: Font.sm, marginTop: 2 },
  dur:        { color: Colors.text3, fontSize: Font.xs },
});
