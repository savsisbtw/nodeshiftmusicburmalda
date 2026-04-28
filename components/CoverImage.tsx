import { useState, useEffect } from 'react';
import { Text, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Radius } from '../constants/theme';

// 12 distinct dark gradients — one is assigned per title hash
const GRADIENTS: [string, string][] = [
  ['#12234a', '#1e4080'],
  ['#1a0e3a', '#3d1a7a'],
  ['#0e2a3a', '#1a5a7a'],
  ['#2a0e1e', '#6a1a3e'],
  ['#0e2a1e', '#1a6a3e'],
  ['#2a1e0e', '#7a4a1e'],
  ['#1e0e2a', '#4a1e6a'],
  ['#0e1e2a', '#1e4a6a'],
  ['#2a0e2a', '#6a1a6a'],
  ['#1e2a0e', '#4a6a1e'],
  ['#2a1e1e', '#6a3a3a'],
  ['#0e2a2a', '#1a6a6a'],
];

function textHash(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

interface Props {
  uri:    string | null;
  title:  string;
  size:   number;
  radius?: number;
  style?: ViewStyle;
  blurRadius?: number;
}

export default function CoverImage({ uri, title, size, radius = Radius.sm, style, blurRadius }: Props) {
  const [failed, setFailed] = useState(false);

  // Reset error state when URI changes (new track loaded)
  useEffect(() => { setFailed(false); }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={[{ width: size, height: size, borderRadius: radius, backgroundColor: '#1a1a1a' }, style]}
        contentFit="cover"
        transition={250}
        blurRadius={blurRadius}
        onError={() => setFailed(true)}
      />
    );
  }

  const [c1, c2] = GRADIENTS[textHash(title || '') % GRADIENTS.length];
  const letter   = (title || '?').trim().toUpperCase()[0];
  const fontSize = size * 0.36;

  return (
    <LinearGradient
      colors={[c1, c2]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }, style]}
    >
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize, fontWeight: '800', textAlign: 'center' }}>
        {letter}
      </Text>
    </LinearGradient>
  );
}
