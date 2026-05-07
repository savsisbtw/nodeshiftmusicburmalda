/**
 * ShareTrackModal — share sheet + QR for co-listening (deep link, no backend)
 * Co-listening: generates a deep link burmalda://listen?tid=123&ts=456
 * Friend opens it → app seeks to same position and plays same track
 */
import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, Alert } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(deepLink, {
          dialogTitle: `${track.artist} — ${track.title}`,
        });
      } else {
        await Clipboard.setStringAsync(shareText);
        Alert.alert('Скопировано', 'Ссылка скопирована в буфер');
      }
    } catch {}
  };

  const handleCopy = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(deepLink);
    Alert.alert('Скопировано', 'Ссылка скопирована');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <BlurView intensity={40} tint="dark" style={s.sheet}>
        <View style={s.handle} />

        {/* Track info */}
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

        {/* QR toggle */}
        {showQR && (
          <View style={s.qrWrap}>
            <QRCode
              value={deepLink}
              size={180}
              backgroundColor="transparent"
              color={Colors.text}
            />
            <Text style={s.qrHint}>Друг сканирует — сразу переходит к этому месту</Text>
          </View>
        )}

        {/* Actions */}
        <View style={s.actions}>
          <ActionBtn
            icon="share"
            label="Поделиться"
            onPress={handleShare}
          />
          <ActionBtn
            icon="copy"
            label="Скопировать ссылку"
            onPress={handleCopy}
          />
          <ActionBtn
            icon="qr"
            label={showQR ? 'Скрыть QR' : 'QR-код'}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowQR(v => !v); }}
            active={showQR}
          />
        </View>

        <Text style={s.hint}>
          Совместное прослушивание: друг откроет ссылку и приложение перейдёт к этому треку и позиции
        </Text>

        <Pressable style={s.closeBtn} onPress={onClose}>
          <Text style={s.closeTxt}>Закрыть</Text>
        </Pressable>
      </BlurView>
    </Modal>
  );
}

function ActionBtn({ icon, label, onPress, active = false }: {
  icon: 'share' | 'copy' | 'qr'; label: string; onPress: () => void; active?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[s.actionBtn, active && s.actionBtnActive]}>
      <View style={s.actionIcon}>
        {icon === 'share' && (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" stroke={active ? Colors.accent : Colors.text} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        )}
        {icon === 'copy' && (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M16 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2" stroke={active ? Colors.accent : Colors.text} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        )}
        {icon === 'qr' && (
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3zM15 15h2v2h-2zM19 15h2v2h-2zM17 17h2v2h-2zM15 19h2v2h-2zM19 19h2v2h-2z" stroke={active ? Colors.accent : Colors.text} strokeWidth={1.8} strokeLinecap="round" />
          </Svg>
        )}
      </View>
      <Text style={[s.actionLabel, active && { color: Colors.accent }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  backdrop:      { flex: 1 },
  sheet:         { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, overflow: 'hidden', borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  handle:        { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', alignSelf: 'center', marginBottom: 20 },
  trackRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 24 },
  cover:         { width: 52, height: 52, borderRadius: Radius.sm },
  title:         { color: Colors.text, fontSize: Font.md, fontWeight: '700' },
  artist:        { color: 'rgba(255,255,255,0.55)', fontSize: Font.sm, marginTop: 2 },
  qrWrap:        { alignItems: 'center', marginBottom: 24, padding: 20, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16 },
  qrHint:        { color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 12, textAlign: 'center' },
  actions:       { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn:     { flex: 1, alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 8 },
  actionBtnActive: { backgroundColor: `${Colors.accent}20`, borderWidth: 1, borderColor: `${Colors.accent}50` },
  actionIcon:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  actionLabel:   { color: Colors.text, fontSize: 11, fontWeight: '600', textAlign: 'center' },
  hint:          { color: 'rgba(255,255,255,0.3)', fontSize: 11, textAlign: 'center', lineHeight: 16, marginBottom: 20 },
  closeBtn:      { paddingVertical: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14 },
  closeTxt:      { color: Colors.text, fontSize: Font.md, fontWeight: '600' },
});
