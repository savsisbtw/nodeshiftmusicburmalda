import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withSpring,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import { Colors, Radius } from '../constants/theme';
import { useOffline } from '../store';
import { Track, coverUrl } from '../services/api';

interface Props {
  track: Track;
  size?: number;
  showLabel?: boolean;
}

const DL_DIR = FileSystem.documentDirectory + 'tracks/';

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(DL_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(DL_DIR, { intermediates: true });
}

function getLocalPath(trackId: number, filename: string) {
  const ext = filename.split('.').pop() || 'mp3';
  return `${DL_DIR}${trackId}.${ext}`;
}

export default function TrackDownloadButton({ track, size = 22, showLabel = false }: Props) {
  const { downloadedTracks, downloading, setDownloading, addDownloadedTrack } = useOffline();
  const isDownloaded = downloadedTracks.has(track.id);
  const dlProgress = downloading.get(track.id);
  const isDownloading = dlProgress !== undefined;

  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const progressWidth = useAnimatedStyle(() => ({
    width: withTiming(`${(dlProgress ?? 0) * 100}%` as any, { duration: 150 }),
  }));

  const startDownload = useCallback(async () => {
    if (isDownloaded || isDownloading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSpring(0.85, { damping: 8 }, () => { scale.value = withSpring(1); });

    try {
      await ensureDir();
      const url = track.cdn_url || track.cdn_url2;
      if (!url) { Alert.alert('Ошибка', 'URL трека недоступен'); return; }

      const localPath = getLocalPath(track.id, track.filename || `${track.id}.mp3`);
      setDownloading(track.id, 0.01);

      const callback = (dp: FileSystem.DownloadProgressData) => {
        const pct = dp.totalBytesExpectedToWrite > 0
          ? dp.totalBytesWritten / dp.totalBytesExpectedToWrite
          : 0;
        setDownloading(track.id, pct);
      };

      const downloadResumable = FileSystem.createDownloadResumable(url, localPath, {}, callback);
      const result = await downloadResumable.downloadAsync();

      if (result?.uri) {
        addDownloadedTrack(track.id);
        setDownloading(track.id, 1);
        // Save metadata locally
        const metaPath = `${DL_DIR}${track.id}.json`;
        await FileSystem.writeAsStringAsync(metaPath, JSON.stringify({
          id: track.id, title: track.title, artist: track.artist,
          filename: track.filename, cover_url: track.cover_url,
          localPath: result.uri,
        }));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (e: any) {
      setDownloading(track.id, 1);
      Alert.alert('Ошибка загрузки', e?.message || 'Попробуйте снова');
    }
  }, [track, isDownloaded, isDownloading]);

  const iconColor = isDownloaded
    ? Colors.accent
    : isDownloading
      ? 'rgba(255,255,255,0.4)'
      : 'rgba(255,255,255,0.7)';

  return (
    <Animated.View style={scaleStyle}>
      <Pressable onPress={startDownload} style={s.btn} hitSlop={12}>
        {isDownloading ? (
          <View style={s.progressWrap}>
            <View style={s.progressBg}>
              <Animated.View style={[s.progressFill, progressWidth]} />
            </View>
            <Text style={s.pctText}>{Math.round((dlProgress ?? 0) * 100)}%</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', flexDirection: 'row', gap: 4 }}>
            {isDownloaded ? (
              <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Circle cx={12} cy={12} r={10} stroke={Colors.accent} strokeWidth={1.5} />
                <Path d="M8 12l3 3 5-5" stroke={Colors.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            ) : (
              <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Path d="M12 3v13M7 11l5 5 5-5" stroke={iconColor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M5 20h14" stroke={iconColor} strokeWidth={2} strokeLinecap="round" />
              </Svg>
            )}
            {showLabel && (
              <Text style={[s.label, { color: iconColor }]}>
                {isDownloaded ? 'Скачано' : 'Скачать'}
              </Text>
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  btn: { alignItems: 'center', justifyContent: 'center' },
  progressWrap: { alignItems: 'center', gap: 4 },
  progressBg: { width: 48, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: Colors.accent, borderRadius: 2 },
  pctText: { color: Colors.accent, fontSize: 9, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600' },
});
