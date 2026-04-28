import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, TextInput, Pressable } from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Font, Spacing, Radius, TAB_BAR_HEIGHT, MINI_PLAYER_HEIGHT } from '../../constants/theme';
import { getTracks, Track, coverUrl } from '../../services/api';
import { usePlayer, useLikes } from '../../store';

export default function LibraryScreen() {
  const [all, setAll]         = useState<Track[]>([]);
  const [filtered, setFiltered] = useState<Track[]>([]);
  const [query, setQuery]     = useState('');
  const insets = useSafeAreaInsets();
  const { setQueue } = usePlayer();
  const { toggleLike, isLiked } = useLikes();

  useEffect(() => {
    getTracks().then(t => { setAll(t); setFiltered(t); });
  }, []);

  useEffect(() => {
    const q = query.toLowerCase();
    setFiltered(q ? all.filter(t =>
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    ) : all);
  }, [query, all]);

  const playTrack = (idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQueue(filtered, idx);
    usePlayer.getState().setExpanded(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Библиотека</Text>
        <Text style={styles.count}>{all.length} треков</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 12 }}>
          <Circle cx={11} cy={11} r={8} stroke={Colors.text3} strokeWidth={1.8} />
          <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={Colors.text3} strokeWidth={1.8} strokeLinecap="round" />
        </Svg>
        <TextInput
          style={styles.searchInput}
          placeholder="Поиск треков..."
          placeholderTextColor={Colors.text3}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          autoCorrect={false}
        />
        {!!query && (
          <Pressable onPress={() => setQuery('')} hitSlop={12} style={{ paddingRight: 12 }}>
            <Text style={{ color: Colors.text3, fontSize: 12 }}>✕</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={t => String(t.id)}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <TrackItem
            track={item}
            index={index}
            liked={isLiked(item.id)}
            onPress={() => playTrack(index)}
            onLike={() => toggleLike(item.id)}
          />
        )}
      />
    </View>
  );
}

function TrackItem({ track, index, liked, onPress, onLike }: {
  track: Track; index: number; liked: boolean; onPress: () => void; onLike: () => void;
}) {
  const { queue, index: qi } = usePlayer();
  const active = queue[qi]?.id === track.id;
  const cover  = coverUrl(track.cover_url);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 25, 300)).duration(300)}>
      <Pressable
        onPress={onPress}
        style={[styles.row, active && styles.rowActive]}
      >
        <Text style={styles.num}>{index + 1}</Text>
        <Image
          source={cover ? { uri: cover } : require('../../assets/placeholder.png')}
          style={styles.cover}
          contentFit="cover"
          transition={200}
        />
        <View style={{ flex: 1 }}>
          <Text style={[styles.trackTitle, active && { color: Colors.accent }]} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
        </View>
        <Pressable onPress={onLike} hitSlop={12}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill={liked ? Colors.pink : 'none'}>
            <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={liked ? Colors.pink : Colors.text3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
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
  container:  { flex: 1, backgroundColor: Colors.bg },
  header:     { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  title:      { color: Colors.text, fontSize: Font.xxl, fontWeight: '800', letterSpacing: -0.5, flex: 1 },
  count:      { color: Colors.text3, fontSize: Font.sm },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, marginHorizontal: Spacing.md, marginBottom: Spacing.md, gap: 8 },
  searchInput:{ flex: 1, color: Colors.text, fontSize: Font.md, paddingVertical: 11, paddingRight: Spacing.md },
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: Spacing.sm, borderRadius: Radius.sm, paddingHorizontal: 4 },
  rowActive:  { backgroundColor: Colors.surface },
  num:        { width: 22, color: Colors.text3, fontSize: Font.sm, textAlign: 'center' },
  cover:      { width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: Colors.elevated },
  trackTitle: { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  artist:     { color: Colors.text2, fontSize: Font.sm, marginTop: 2 },
  dur:        { color: Colors.text3, fontSize: Font.xs },
});
