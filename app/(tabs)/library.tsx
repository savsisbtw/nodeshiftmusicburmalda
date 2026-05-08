import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, Pressable, Alert, TextInput, Modal,
  ActionSheetIOS, Platform,
} from 'react-native';
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring, withRepeat } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Font, Spacing, Radius, TAB_BAR_HEIGHT, MINI_PLAYER_HEIGHT } from '../../constants/theme';
import { getTracks, Track, coverUrl } from '../../services/api';
import { usePlayer, useLikes, useHidden, usePlaylists, Playlist } from '../../store';
import { getMyWaveTracks } from '../../services/mywave';
import TrackDownloadButton from '../../components/DownloadButton';
import WaveAnimation from '../../components/WaveAnimation';
import { LinearGradient } from 'expo-linear-gradient';

type Tab = 'tracks' | 'playlists' | 'wave';

export default function LibraryScreen() {
  const [all, setAll]           = useState<Track[]>([]);
  const [query, setQuery]       = useState('');
  const [tab, setTab]           = useState<Tab>('tracks');
  const [wave, setWave]         = useState<Track[]>([]);
  const [waveLoading, setWaveLoading] = useState(false);
  const [newPlName, setNewPlName] = useState('');
  const [showNewPl, setShowNewPl]   = useState(false);
  const insets = useSafeAreaInsets();
  const { setQueue } = usePlayer();
  const { toggleLike, isLiked } = useLikes();
  const { isHidden, toggleHide } = useHidden();
  const { playlists, createPlaylist, deletePlaylist, renamePlaylist } = usePlaylists();

  useEffect(() => {
    getTracks().then(t => setAll(t));
  }, []);

  const visible = all.filter(t => {
    if (isHidden(t.id)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
  });

  const loadWave = useCallback(async () => {
    if (wave.length > 0) { setTab('wave'); return; }
    setWaveLoading(true);
    const tracks = await getMyWaveTracks(all);
    setWave(tracks);
    setWaveLoading(false);
    setTab('wave');
  }, [all, wave.length]);

  const playTrack = (list: Track[], idx: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQueue(list, idx);
    usePlayer.getState().setExpanded(true);
  };

  const handleLongPress = (track: Track) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const hidden = isHidden(track.id);
    const options = [
      hidden ? 'Показать трек' : 'Скрыть из библиотеки',
      isLiked(track.id) ? 'Убрать из избранного' : 'В избранное',
      'Отмена',
    ];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, destructiveButtonIndex: 0 },
        (i) => {
          if (i === 0) toggleHide(track.id);
          if (i === 1) toggleLike(track.id);
        }
      );
    } else {
      Alert.alert(track.title, undefined, [
        { text: hidden ? 'Показать' : 'Скрыть', onPress: () => toggleHide(track.id), style: 'destructive' },
        { text: isLiked(track.id) ? 'Убрать из избранного' : 'В избранное', onPress: () => toggleLike(track.id) },
        { text: 'Отмена', style: 'cancel' },
      ]);
    }
  };

  const handlePlaylistLongPress = (pl: Playlist) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const options = ['Переименовать', 'Удалить', 'Отмена'];
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: 2, destructiveButtonIndex: 1 },
        (i) => {
          if (i === 0) {
            Alert.prompt('Переименовать', undefined, (name) => {
              if (name?.trim()) renamePlaylist(pl.id, name.trim());
            }, undefined, pl.name);
          }
          if (i === 1) deletePlaylist(pl.id);
        }
      );
    } else {
      Alert.alert(pl.name, undefined, [
        { text: 'Удалить', onPress: () => deletePlaylist(pl.id), style: 'destructive' },
        { text: 'Отмена', style: 'cancel' },
      ]);
    }
  };

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>Библиотека</Text>
        <Pressable onPress={() => setShowNewPl(true)} style={s.addBtn} hitSlop={12}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={Colors.accent} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={s.tabRow}>
        {(['tracks', 'playlists', 'wave'] as Tab[]).map(t => (
          <Pressable
            key={t}
            style={[s.tabBtn, tab === t && s.tabBtnActive]}
            onPress={() => t === 'wave' ? loadWave() : setTab(t)}
          >
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>
              {t === 'tracks' ? 'Треки' : t === 'playlists' ? 'Плейлисты' : 'Моя волна'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Search (only on tracks tab) */}
      {tab === 'tracks' && (
        <View style={s.searchWrap}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Circle cx={11} cy={11} r={8} stroke={Colors.text3} strokeWidth={1.8} />
            <Line x1="21" y1="21" x2="16.65" y2="16.65" stroke={Colors.text3} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
          <TextInput
            style={s.searchInput}
            placeholder="Поиск..."
            placeholderTextColor={Colors.text3}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
            autoCorrect={false}
          />
          {!!query && (
            <Pressable onPress={() => setQuery('')} hitSlop={12} style={{ paddingRight: 12 }}>
              <Text style={{ color: Colors.text3, fontSize: 13 }}>x</Text>
            </Pressable>
          )}
        </View>
      )}

      {/* Content */}
      {tab === 'tracks' && (
        <FlatList
          data={visible}
          keyExtractor={t => String(t.id)}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <TrackRow
              track={item}
              index={index}
              liked={isLiked(item.id)}
              onPress={() => playTrack(visible, index)}
              onLike={() => toggleLike(item.id)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
        />
      )}

      {tab === 'playlists' && (
        <FlatList
          data={playlists}
          keyExtractor={p => p.id}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24 }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => Haptics.selectionAsync()}
          ListEmptyComponent={<EmptyState text="Нет плейлистов. Нажмите + чтобы создать." />}
          renderItem={({ item }) => (
            <PlaylistRow
              playlist={item}
              tracks={all}
              onPress={() => {
                const tracks = all.filter(t => item.trackIds.includes(t.id));
                if (tracks.length) playTrack(tracks, 0);
              }}
              onLongPress={() => handlePlaylistLongPress(item)}
            />
          )}
        />
      )}

      {tab === 'wave' && (
        <FlatList
          data={wave}
          keyExtractor={t => String(t.id)}
          contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: TAB_BAR_HEIGHT + MINI_PLAYER_HEIGHT + 24 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Animated.View entering={FadeInDown.duration(400)} style={s.waveHeader}>
              <LinearGradient
                colors={['rgba(67, 97, 238, 0.2)', 'rgba(123, 47, 247, 0.05)', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <View style={s.waveViz}>
                <WaveAnimation active={!waveLoading} barCount={60} height={80} />
              </View>
              <View style={s.waveGradientOverlay} pointerEvents="none" />
              <Text style={s.waveTitle}>Моя волна</Text>
              <Text style={s.waveSub}>
                {waveLoading ? 'DeepSeek подбирает идеальные треки...' : `${wave.length} треков на основе вашего вкуса`}
              </Text>
              {wave.length > 0 && (
                <PulsePlayButton onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  playTrack(wave, 0);
                }} />
              )}
            </Animated.View>
          }
          ListEmptyComponent={
            waveLoading
              ? <EmptyState text="Подбираем треки..." />
              : <EmptyState text="Лайкните треки, чтобы получить рекомендации" />
          }
          renderItem={({ item, index }) => (
            <TrackRow
              track={item}
              index={index}
              liked={isLiked(item.id)}
              onPress={() => playTrack(wave, index)}
              onLike={() => toggleLike(item.id)}
              onLongPress={() => handleLongPress(item)}
            />
          )}
        />
      )}

      {/* New playlist modal */}
      <Modal visible={showNewPl} transparent animationType="slide">
        <Pressable style={s.modalBg} onPress={() => setShowNewPl(false)} />
        <View style={s.modalSheet}>
          <Text style={s.modalTitle}>Новый плейлист</Text>
          <TextInput
            style={s.modalInput}
            placeholder="Название..."
            placeholderTextColor={Colors.text3}
            value={newPlName}
            onChangeText={setNewPlName}
            autoFocus
            returnKeyType="done"
          />
          <View style={s.modalBtns}>
            <Pressable style={s.modalCancel} onPress={() => { setShowNewPl(false); setNewPlName(''); }}>
              <Text style={s.modalCancelText}>Отмена</Text>
            </Pressable>
            <Pressable
              style={[s.modalCreate, !newPlName.trim() && { opacity: 0.4 }]}
              onPress={() => {
                if (!newPlName.trim()) return;
                createPlaylist(newPlName.trim());
                setNewPlName('');
                setShowNewPl(false);
                setTab('playlists');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }}
            >
              <Text style={s.modalCreateText}>Создать</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function PulsePlayButton({ onPress }: { onPress: () => void }) {
  const scale = useSharedValue(1);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    glow.value = withRepeat(withSpring(0.8, { damping: 2 }), -1, true);
  }, []);

  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const gl = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View style={st}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.accent, borderRadius: 30, transform: [{ scale: 1.1 }] }, gl]} />
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.92, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        onPress={onPress}
        style={s.playAllBtn}
      >
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="#fff">
          <Path d="M8 5v14l11-7z" />
        </Svg>
        <Text style={s.playAllText}>Слушать поток</Text>
      </Pressable>
    </Animated.View>
  );
}

function TrackRow({ track, index, liked, onPress, onLike, onLongPress }: {
  track: Track; index: number; liked: boolean;
  onPress: () => void; onLike: () => void; onLongPress: () => void;
}) {
  const { queue, index: qi } = usePlayer();
  const active = queue[qi]?.id === track.id;
  const cover  = coverUrl(track.cover_url);
  const ext    = (track.filename?.split('.').pop() || 'MP3').toUpperCase();

  return (
    <Animated.View entering={FadeInDown.delay(Math.min(index * 20, 300)).duration(250)}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={[s.row, active && s.rowActive]}
      >
        <Image
          source={cover ? { uri: cover } : require('../../assets/placeholder.png')}
          style={s.cover}
          contentFit="cover"
          transition={200}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[s.trackTitle, active && { color: Colors.accent }]} numberOfLines={1}>{track.title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <Text style={s.artist} numberOfLines={1}>{track.artist}</Text>
            <View style={s.extBadge}><Text style={s.extText}>{ext}</Text></View>
          </View>
        </View>
        <TrackDownloadButton track={track} size={18} />
        <Pressable onPress={onLike} hitSlop={12}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill={liked ? Colors.pink : 'none'}>
            <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke={liked ? Colors.pink : Colors.text3} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

function PlaylistRow({ playlist, tracks, onPress, onLongPress }: {
  playlist: Playlist; tracks: Track[]; onPress: () => void; onLongPress: () => void;
}) {
  const scale = useSharedValue(1);
  const aStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const count = playlist.trackIds.length;
  const cover = tracks.find(t => playlist.trackIds.includes(t.id))?.cover_url;
  const coverUri = cover ? coverUrl(cover) : null;

  return (
    <Animated.View style={aStyle}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        onPressIn={() => { scale.value = withSpring(0.97, { damping: 15 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
        style={s.plRow}
      >
        <View style={s.plCover}>
          {coverUri
            ? <Image source={{ uri: coverUri }} style={{ width: 52, height: 52, borderRadius: Radius.sm }} contentFit="cover" />
            : <View style={[s.plCoverFallback]}>
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path d="M9 18V5l12-2v13" stroke={Colors.text3} strokeWidth={1.8} strokeLinecap="round" />
                  <Circle cx={6} cy={18} r={3} stroke={Colors.text3} strokeWidth={1.8} />
                  <Circle cx={18} cy={16} r={3} stroke={Colors.text3} strokeWidth={1.8} />
                </Svg>
              </View>
          }
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.plName} numberOfLines={1}>{playlist.name}</Text>
          <Text style={s.plCount}>{count} {count === 1 ? 'трек' : count < 5 ? 'трека' : 'треков'}</Text>
        </View>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M9 18l6-6-6-6" stroke={Colors.text3} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
    </Animated.View>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <View style={{ alignItems: 'center', marginTop: 80, paddingHorizontal: 32 }}>
      <Text style={{ color: Colors.text3, fontSize: Font.sm, textAlign: 'center', lineHeight: 22 }}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: Colors.bg },
  header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 8 },
  title:        { color: Colors.text, fontSize: Font.xxl, fontWeight: '800', letterSpacing: -0.5, flex: 1 },
  addBtn:       { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  tabRow:       { flexDirection: 'row', paddingHorizontal: Spacing.md, gap: 8, marginBottom: 12 },
  tabBtn:       { paddingHorizontal: 16, paddingVertical: 8, borderRadius: Radius.full, backgroundColor: Colors.surface },
  tabBtnActive: { backgroundColor: Colors.accent },
  tabText:      { color: Colors.text2, fontSize: Font.sm, fontWeight: '600' },
  tabTextActive:{ color: '#fff', fontSize: Font.sm, fontWeight: '700' },
  searchWrap:   { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: Radius.md, marginHorizontal: Spacing.md, marginBottom: Spacing.md, gap: 8, paddingLeft: 12 },
  searchInput:  { flex: 1, color: Colors.text, fontSize: Font.md, paddingVertical: 11 },
  row:          { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10, borderRadius: Radius.sm, paddingHorizontal: 4 },
  rowActive:    { backgroundColor: Colors.surface },
  cover:        { width: 46, height: 46, borderRadius: Radius.sm, backgroundColor: Colors.elevated, flexShrink: 0 },
  trackTitle:   { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  artist:       { color: Colors.text2, fontSize: Font.sm, flex: 1 },
  extBadge:     { backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  extText:      { color: Colors.text3, fontSize: 9, fontWeight: '700', letterSpacing: 0.5 },
  plRow:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 14, paddingHorizontal: 4 },
  plCover:      { width: 52, height: 52, borderRadius: Radius.sm, overflow: 'hidden', flexShrink: 0 },
  plCoverFallback: { width: 52, height: 52, backgroundColor: Colors.elevated, borderRadius: Radius.sm, alignItems: 'center', justifyContent: 'center' },
  plName:       { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
  plCount:      { color: Colors.text2, fontSize: Font.sm, marginTop: 2 },
  waveHeader:        { paddingBottom: 24, paddingTop: 12, alignItems: 'center', overflow: 'hidden', borderRadius: 24, marginBottom: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  waveViz:           { width: '100%', height: 90, overflow: 'hidden', marginBottom: 0 },
  waveGradientOverlay: { position: 'absolute', top: 0, left: 0, right: 0, height: 90, backgroundColor: 'transparent' },
  waveTitle:         { color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginTop: 16 },
  waveSub:           { color: 'rgba(255,255,255,0.5)', fontSize: Font.sm, marginTop: 4, marginBottom: 20 },
  playAllBtn:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.accent, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 30 },
  playAllText:       { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  modalBg:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet:   { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle:   { color: Colors.text, fontSize: Font.lg, fontWeight: '700', marginBottom: 16 },
  modalInput:   { backgroundColor: Colors.elevated, color: Colors.text, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: Font.md, marginBottom: 16 },
  modalBtns:    { flexDirection: 'row', gap: 12 },
  modalCancel:  { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.elevated, alignItems: 'center' },
  modalCancelText: { color: Colors.text2, fontWeight: '600' },
  modalCreate:  { flex: 1, paddingVertical: 14, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  modalCreateText: { color: '#fff', fontWeight: '700' },
});
