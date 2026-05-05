import { View, StyleSheet, Pressable, Text, ActivityIndicator } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useMemo } from 'react';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { Colors, Font } from '../constants/theme';

export interface DownloadButtonProps {
  trackId: number;
  isDownloaded?: boolean;
  downloadProgress?: number; // 0-1
  onDownload?: () => void;
  onDelete?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export default function DownloadButton({
  trackId,
  isDownloaded = false,
  downloadProgress = 0,
  onDownload,
  onDelete,
  size = 'md',
}: DownloadButtonProps) {
  const sizing = useMemo(() => {
    const map = { sm: 20, md: 24, lg: 32 };
    return map[size];
  }, [size]);

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isDownloaded) {
      onDelete?.();
    } else {
      onDownload?.();
    }
  };

  const isLoading = downloadProgress > 0 && downloadProgress < 1;

  if (isLoading) {
    return (
      <Animated.View entering={FadeIn}>
        <View style={[styles.container, { width: sizing, height: sizing }]}>
          <ActivityIndicator color={Colors.accent} size={sizing * 0.6} />
          {downloadProgress > 0.2 && (
            <Text style={[styles.progress, { fontSize: sizing * 0.3 }]}>
              {Math.round(downloadProgress * 100)}%
            </Text>
          )}
        </View>
      </Animated.View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.button,
        {
          width: sizing,
          height: sizing,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      {isDownloaded ? (
        <Svg width={sizing} height={sizing} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"
            fill={Colors.accent}
          />
        </Svg>
      ) : (
        <Svg width={sizing} height={sizing} viewBox="0 0 24 24" fill="none">
          <Path
            d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"
            fill={Colors.text2}
          />
        </Svg>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  progress: {
    color: Colors.accent,
    fontFamily: Font.family.medium,
    marginTop: 2,
  },
});
