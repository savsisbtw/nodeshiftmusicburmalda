import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  FadeIn, SlideInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import Svg, { Path, Circle, Polyline, Line } from 'react-native-svg';
import { Colors, Font, Radius, Spacing } from '../constants/theme';
import { buildOAuthUrl, exchangeCode, saveTokens } from '../services/api';
import { useAuth } from '../store';
import { saveUser } from '../hooks/useAuth';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { setUser } = useAuth();
  const btnScale = useSharedValue(1);

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handleLogin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const state  = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const url    = buildOAuthUrl(state);
      const result = await WebBrowser.openAuthSessionAsync(url, 'burmalda://auth/callback');

      if (result.type !== 'success') {
        setError('Авторизация отменена');
        return;
      }
      const parsed = Linking.parse(result.url);
      const code   = parsed.queryParams?.code as string | undefined;
      if (!code) {
        setError((parsed.queryParams?.error as string) || 'Ошибка авторизации');
        return;
      }
      const data = await exchangeCode(code);
      await saveTokens(data.access_token, data.refresh_token);
      await saveUser(data.user);
      setUser(data.user);
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message || 'Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  }, [setUser]);

  return (
    <View style={styles.container}>
      <Blob color={Colors.accent} size={420} left={-80}  top={-100}  delay={0} />
      <Blob color="#6c63ff"       size={320} left={width - 200} top={height * 0.55} delay={2000} />
      <Blob color={Colors.accent} size={240} left={width * 0.3} top={height - 100} delay={4000} />

      <Animated.View style={styles.card} entering={FadeIn.duration(600)}>
        <Animated.View entering={SlideInDown.delay(100).springify()} style={styles.logoWrap}>
          <LinearGradient colors={[Colors.accent, '#2a5cc4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoIcon}>
            <Svg width={38} height={38} viewBox="0 0 24 24" fill="none">
              <Path d="M9 18V5l12-2v13" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
              <Circle cx={6} cy={18} r={3} fill="#fff" />
              <Circle cx={18} cy={16} r={3} fill="#fff" />
            </Svg>
          </LinearGradient>
          <Text style={styles.logoTitle}>Burmalda Music</Text>
          <Text style={styles.logoSub}>by NodeShift</Text>
        </Animated.View>

        <Animated.View entering={SlideInDown.delay(200).springify()} style={{ width: '100%' }}>
          <Animated.View style={btnStyle}>
            <Pressable
              style={styles.btnWrap}
              disabled={loading}
              onPressIn={() => { btnScale.value = withSpring(0.96, { damping: 14 }); }}
              onPressOut={() => { btnScale.value = withSpring(1,    { damping: 14 }); }}
              onPress={handleLogin}
            >
              <LinearGradient colors={[Colors.accent, '#2a5cc4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path d="M20 17.58A5 5 0 0 0 18 8h-1.26A8 8 0 1 0 4 16.25" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Polyline points="8 17 12 13 16 17" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                      <Line x1="12" y1="13" x2="12" y2="21" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
                    </Svg>
                  )}
                <Text style={styles.btnText}>
                  {loading ? 'Ожидаем авторизацию…' : 'Войти через NodeShift'}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {!!error && (
            <Animated.Text entering={FadeIn} style={styles.error}>{error}</Animated.Text>
          )}
        </Animated.View>

        <Animated.Text entering={FadeIn.delay(300)} style={styles.footer}>
          Нажимая «Войти», вы соглашаетесь с{'\n'}условиями использования NodeShift
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

function Blob({ color, size, left, top, delay }: {
  color: string; size: number; left: number; top: number; delay: number;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);

  useEffect(() => {
    const animate = () => {
      tx.value = withTiming(25,  { duration: 8000 }, () =>
        tx.value = withTiming(-20, { duration: 8000 }, () =>
          tx.value = withTiming(0, { duration: 8000 }, animate)));
      ty.value = withTiming(-35, { duration: 8000 }, () =>
        ty.value = withTiming(18, { duration: 8000 }, () =>
          ty.value = withTiming(0, { duration: 8000 })));
    };
    const t = setTimeout(animate, delay);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  return (
    <Animated.View style={[styles.blob, style, {
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, left, top,
    }]} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  blob:      { position: 'absolute', opacity: 0.12 },
  card:      { width: '100%', maxWidth: 360, alignItems: 'center', paddingHorizontal: Spacing.xl, zIndex: 10 },
  logoWrap:  { alignItems: 'center', marginBottom: 40 },
  logoIcon:  { width: 84, height: 84, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md, shadowColor: Colors.accent, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.45, shadowRadius: 22 },
  logoTitle: { color: Colors.text, fontSize: Font.xxl, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  logoSub:   { color: Colors.text3, fontSize: Font.sm, fontWeight: '500' },
  btnWrap:   { width: '100%', borderRadius: Radius.md, overflow: 'hidden', shadowColor: Colors.accent, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.35, shadowRadius: 18 },
  btn:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 16, paddingHorizontal: 20 },
  btnText:   { color: '#fff', fontSize: Font.md, fontWeight: '700' },
  error:     { color: Colors.red, fontSize: Font.sm, textAlign: 'center', marginTop: Spacing.sm },
  footer:    { marginTop: Spacing.xl, color: Colors.text3, fontSize: Font.xs, textAlign: 'center', lineHeight: 18 },
});
