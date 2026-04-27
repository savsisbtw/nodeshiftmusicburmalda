import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TextInput, Pressable,
} from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Circle, Line } from 'react-native-svg';
import { Colors, Font, Spacing, Radius, TAB_BAR_HEIGHT, MINI_PLAYER_HEIGHT } from '../../constants/theme';
import { getTracks, Track, coverUrl } from '../../services/api';
import { usePlayer } from '../../store';

export default function LibraryScreen() {
  const [all, setAll]         = useState<Track[]>([]);
  const [filtered, setFiltered] = useState<Track[]>([]);
  const [query, setQuery]     = useState('');
  const insets = useSafeAreaInsets();
  const { setQueue } = usePlayer();

  useEffect(() => {
    getTracks().then(t => { setAll(t); setFiltered(t); });
  }, []);

  useEffect(() => {
    const q = query.toLowerCase();
    setFiltered(q ? all.filter(t =>
      t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
    ) : all);
  }, [query, all]);

  const playTrack = (track: Track, index: number) => {
    setQueue(filtered, index);
    usePlayer.getState().setExpanded(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Библиотека</Text>
        <Text style={styles.count}>{all.length} треков</Text>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <SearchSvg />
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
          <Pressable onPress={() => setQuery('')} hitSlop={12}>
            <Text style={styles.clearBtn}>✕</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={t => String(t.id)}
        contentContainerStyle={{
          paddingHorizontal: Spacing.md,
          paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24,
        }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item, index }) => (
          <TrackItem track={item} index={index} onPress={() => playTrack(item, index)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
      />
    </View>
  );
}

function TrackItem({ track, index, onPress }: { track: Track; index: number; onPress: () => void }) {
  const { queue, index: qi } = usePlayer();
  const active = queue[qi]?.id === track.id;
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cover = coverUrl(track.cover_url);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 30, 300)).duration(300)} style={aStyle}>
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={onPress}
        style={[styles.row, active && styles.rowActive]}
      >
        <View style={styles.numWrap}>
          {active
            ? <View style={styles.eqDots}>{[0,1,2].map(i => <EqDot key={i} delay={i * 150} />)}</View>
            : <Text style={styles.num}>{index + 1}</Text>}
        </View>
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

function EqDot({ delay }: { delay: number }) {
  const h = useSharedValue(4);
  const style = useAnimatedStyle(() => ({ height: h.value }));

  useEffect(() => {
    const loop = () => {
      h.value = withSpring(12 + Math.random() * 8, { damping: 6 }, () => {
        h.value = withSpring(4, { damping: 6 }, loop);
      });
    };
    const t = setTimeout(loop, delay);
    return () => clearTimeout(t);
  }, []);

  return <Animated.View style={[styles.dot, style]} />;
}

function SearchSvg() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" style={{ marginLeft: 12 }}>
      <Circle cx={11} cy={11} r={8} stroke={Colors.text3} strokeWidth={1.8} />
      <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={Colors.text3} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: Colors.bg },
  header:      { paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm, flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  title:       { color: Colors.text, fontSize: Font.xxl, fontWeight: '800', letterSpacing: -0.5 },
  count:       { color: Colors.text3, fontSize: Font.sm },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, marginHorizontal: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  searchInput: { flex: 1, color: Colors.text, fontSize: Font.md, paddingVertical: 12, paddingRight: Spacing.md },
  clearBtn:    { color: Colors.text3, fontSize: Font.sm, paddingRight: 12 },
  row:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm, gap: Spacing.md },
  rowActive:   { backgroundColor: Colors.surface + '80' },
  numWrap:     { width: 28, alignItems: 'center' },
  num:         { color: Colors.text3, fontSize: Font.sm },
  eqDots:      { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 16 },
  dot:         { width: 3, backgroundColor: Colors.green, borderRadius: 2 },
  cover:       { width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: Colors.elevated },
  trackTitle:  { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  artist:      { color: Colors.text2, fontSize: Font.sm, marginTop: 2 },
  dur:         { color: Colors.text3, fontSize: Font.xs, paddingRight: 4 },
  sep:         { height: 1 },
});
