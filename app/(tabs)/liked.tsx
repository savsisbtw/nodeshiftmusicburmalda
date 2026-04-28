import { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { Colors, Font, Spacing, Radius, TAB_BAR_HEIGHT, MINI_PLAYER_HEIGHT } from '../../constants/theme';
import { getTracks, Track, coverUrl } from '../../services/api';
import { usePlayer, useLikes } from '../../store';

export default function LikedScreen() {
  const [all, setAll] = useState<Track[]>([]);
  const insets = useSafeAreaInsets();
  const { setQueue } = usePlayer();
  const { likes, toggleLike } = useLikes();

  useEffect(() => {
    getTracks().then(setAll);
  }, []);

  const liked = all.filter(t => likes.has(t.id));

  const playTrack = (track: Track, idx: number) => {
    setQueue(liked, idx);
    usePlayer.getState().setExpanded(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Svg width={22} height={22} viewBox="0 0 24 24" fill={Colors.pink}>
          <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={Colors.pink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={styles.title}>Понравилось</Text>
        <Text style={styles.count}>{liked.length} треков</Text>
      </View>

      {liked.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>♡</Text>
          <Text style={styles.emptyTitle}>Пусто</Text>
          <Text style={styles.emptyText}>Нажмите ♡ у трека, чтобы добавить его сюда</Text>
        </View>
      ) : (
        <FlatList
          data={liked}
          keyExtractor={t => String(t.id)}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <LikedRow
              track={item}
              index={index}
              onPress={() => playTrack(item, index)}
              onUnlike={() => toggleLike(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

function LikedRow({ track, index, onPress, onUnlike }: {
  track: Track; index: number; onPress: () => void; onUnlike: () => void;
}) {
  const { queue, index: qi } = usePlayer();
  const active = queue[qi]?.id === track.id;
  const scale  = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const cover  = coverUrl(track.cover_url);

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 40, 400)).duration(300)} style={aStyle}>
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
        <View style={styles.info}>
          <Text style={[styles.trackTitle, active && { color: Colors.accent }]} numberOfLines={1}>{track.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{track.artist}</Text>
        </View>
        <Pressable onPress={onUnlike} hitSlop={12} style={styles.likeBtn}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill={Colors.pink}>
            <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={Colors.pink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
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
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.md },
  title:      { color: Colors.text, fontSize: Font.xxl, fontWeight: '800', letterSpacing: -0.5, flex: 1 },
  count:      { color: Colors.text3, fontSize: Font.sm },
  empty:      { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 120 },
  emptyIcon:  { fontSize: 52, color: Colors.text3, marginBottom: 16 },
  emptyTitle: { color: Colors.text, fontSize: Font.lg, fontWeight: '700', marginBottom: 8 },
  emptyText:  { color: Colors.text2, fontSize: Font.sm, textAlign: 'center', lineHeight: 20 },
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: Spacing.md, borderRadius: Radius.sm },
  rowActive:  { backgroundColor: Colors.surface + '80' },
  cover:      { width: 48, height: 48, borderRadius: Radius.sm, backgroundColor: Colors.elevated },
  info:       { flex: 1 },
  trackTitle: { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  artist:     { color: Colors.text2, fontSize: Font.sm, marginTop: 2 },
  likeBtn:    { padding: 4 },
});
