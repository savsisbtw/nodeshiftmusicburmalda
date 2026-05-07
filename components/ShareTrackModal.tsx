/**
 * ShareTrackModal — share + QR co-listening (no backend)
 */
import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Alert, Share, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import Svg, { Path } from 'react-native-svg';
import { Colors, Font, Radius } from '../constants/theme';
import { Track, coverUrl } from '../services/api';

interface Props {
  track: Track;
  progress: number;
  visible: boolean;
  onClose: () => void;
}

function buildDeepLink(trackId: number, position: number) {
  return `burmalda://listen?tid=${trackId}&ts=${Math.floor(position)}`;
}

export default function ShareTrackModal({ track, progress, visible, onClose }: Props) {
  const [showQR, setShowQR] = useState(false);
  const cover = coverUrl(track.cover_url);
  const deepLink = buildDeepLink(track.id, progress);
  const shareText = `${track.artist} — ${track.title}\n${deepLink}`;

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Share.share({ message: shareText, title: `${track.artist} — ${track.title}` });
    } catch {}
  };

  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    try {
      await Clipboard.setStringAsync(deepLink);
      Alert.alert('Скопировано', 'Ссылка скопирована');
    } catch {}
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <BlurView intensity={40} tint="dark" style={s.sheet}>
        <View style={s.handle} />

        <View style={s.trackRow}>
          {cover
            ? <Image source={{ uri: cover }} style={s.cover} contentFit="cover" />
            : <View style={[s.cover, { backgroundColor: Colors.elevated }]} />
          }
          <View style={{ flex: 1 }}>
            <Text style={s.title} numberOfLines={1}>{track.title}</Text>
            <Text style={s.artist} numberOfLines={1}>{track.artist}</Text>
          </View>
        </View>

        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={handleShare}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13"
                stroke={Colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={s.actionLabel}>Поделиться</Text>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={handleCopy}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M16 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2"
                stroke={Colors.text} strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <Text style={s.actionLabel}>Копировать</Text>
          </Pressable>
        </View>

        <Text style={s.hint}>
          Ссылка: {deepLink}
        </Text>

        <Pressable style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeTxt}>Закрыть</Text>
        </Pressable>
      </BlurView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop:    { flex: 1 },
  sheet:       { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, overflow: 'hidden', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  handle:      { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: 20 },
  trackRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  cover:       { width: 52, height: 52, borderRadius: Radius.sm },
  title:       { color: Colors.text, fontSize: Font.md, fontWeight: '700' },
  artist:      { color: 'rgba(255,255,255,0.55)', fontSize: Font.sm, marginTop: 2 },
  actions:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn:   { flex: 1, alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 16 },
  actionLabel: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  hint:        { color: 'rgba(255,255,255,0.3)', fontSize: 10, textAlign: 'center', marginBottom: 20 },
  closeBtn:    { paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 },
  closeTxt:    { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
});
