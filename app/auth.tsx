import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Dimensions, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withRepeat, withSequence, withDelay, Easing,
  FadeIn, FadeInDown, FadeInUp,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle } from 'react-native-svg';
import { Colors, Font } from '../constants/theme';
import { buildOAuthUrl, exchangeCode, saveTokens } from '../services/api';
import { useAuth } from '../store';
import { saveUser } from '../hooks/useAuth';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

const CARD_COLORS: [string, string][] = [
  ['#1a1a5e', '#3a0ca3'],
  ['#0d1b2a', '#1b4332'],
  ['#2d0a3a', '#7b2d8b'],
  ['#1a0a00', '#7c3f00'],
  ['#001b33', '#003d73'],
  ['#1a1a3e', '#4a0080'],
  ['#0a1a00', '#1a4a00'],
  ['#2a0010', '#6a0030'],
  ['#001a2a', '#004a5a'],
  ['#1e0030', '#5e0080'],
  ['#002200', '#004400'],
  ['#300000', '#700000'],
];

function CardRow({ reverse, speed }: { reverse: boolean; speed: number }) {
  const ref = useRef<ScrollView>(null);
  const pos = useRef(0);
  const doubled = [...CARD_COLORS, ...CARD_COLORS, ...CARD_COLORS];
  const max = CARD_COLORS.length * 86;

  useEffect(() => {
    const id = setInterval(() => {
      if (reverse) {
        pos.current = pos.current <= 0 ? max : pos.current - 0.7;
      } else {
        pos.current = pos.current >= max ? 0 : pos.current + 0.7;
      }
      ref.current?.scrollTo({ x: pos.current, animated: false });
    }, speed);
    return () => clearInterval(id);
  }, []);

  return (
    <ScrollView
      ref={ref}
      horizontal
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
    >
      {doubled.map((c, i) => (
        <LinearGradient key={i} colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={card} />
      ))}
    </ScrollView>
  );
}

const card: object = {
  width: 76, height: 76, borderRadius: 14, marginHorizontal: 5, opacity: 0.65,
};

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const { setUser } = useAuth();

  const btnScale = useSharedValue(1);
  const orb1y    = useSharedValue(0);
  const orb2y    = useSharedValue(0);
  const orb1x    = useSharedValue(0);
  const orb2x    = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);

  useEffect(() => {
    orb1y.value = withRepeat(withSequence(
      withTiming(-50, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
      withTiming(30,  { duration: 8000, easing: Easing.inOut(Easing.sin) }),
    ), -1, true);
    orb1x.value = withRepeat(withSequence(
      withTiming(40,  { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      withTiming(-30, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
    ), -1, true);
    orb2y.value = withRepeat(withSequence(
      withTiming(60,  { duration: 10000, easing: Easing.inOut(Easing.sin) }),
      withTiming(-40, { duration: 10000, easing: Easing.inOut(Easing.sin) }),
    ), -1, true);
    orb2x.value = withRepeat(withSequence(
      withTiming(-50, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
      withTiming(40,  { duration: 11000, easing: Easing.inOut(Easing.sin) }),
    ), -1, true);
    glowOpacity.value = withDelay(800, withRepeat(withSequence(
      withTiming(0.8, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      withTiming(0.3, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
    ), -1, false));
  }, []);

  const orb1Style   = useAnimatedStyle(() => ({ transform: [{ translateX: orb1x.value }, { translateY: orb1y.value }] }));
  const orb2Style   = useAnimatedStyle(() => ({ transform: [{ translateX: orb2x.value }, { translateY: orb2y.value }] }));
  const btnStyle    = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));
  const glowStyle   = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  const handleLogin = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);
    setError('');
    try {
      const state  = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const url    = buildOAuthUrl(state);
      const result = await WebBrowser.openAuthSessionAsync(url, 'burmalda://auth/callback');
      if (result.type !== 'success') { setError('Авторизация отменена'); return; }
      const parsed = Linking.parse(result.url);
      const code   = parsed.queryParams?.code as string | undefined;
      if (!code) { setError((parsed.queryParams?.error as string) || 'Ошибка авторизации'); return; }
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
    <View style={s.root}>
      {/* Dark background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#07071a' }]} />
      <LinearGradient
        colors={['#0d0d25', '#07071a', '#07071a']}
        style={StyleSheet.absoluteFill}
      />

      {/* Orbs */}
      <Animated.View style={[s.orb1, orb1Style]}>
        <LinearGradient colors={['#4361ee', '#7b2ff7']} style={s.orbGrad} />
      </Animated.View>
      <Animated.View style={[s.orb2, orb2Style]}>
        <LinearGradient colors={['#e040fb', '#7b2ff7']} style={s.orbGrad} />
      </Animated.View>

      {/* Scrolling cards — top half */}
      <View style={s.carousel}>
        <CardRow reverse={false} speed={16} />
        <CardRow reverse={true}  speed={20} />
        <CardRow reverse={false} speed={13} />
      </View>

      {/* Gradient covers carousel bottom half */}
      <LinearGradient
        colors={['transparent', '#07071a']}
        style={s.fadeBottom}
      />
      <LinearGradient
        colors={['#07071a', 'transparent']}
        style={s.fadeTop}
      />

      {/* Main content */}
      <View style={s.content}>
        {/* Logo icon */}
        <Animated.View entering={FadeIn.delay(200).duration(600)} style={s.logoRow}>
          <View style={s.logoShadow}>
            <Animated.View style={glowStyle}>
              <LinearGradient
                colors={['#4361ee', '#7b2ff7', '#e040fb']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={s.logoBox}
              >
                <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
                  <Path
                    d="M3 16 Q7 7, 11 16 Q15 25, 19 16 Q23 7, 29 16"
                    stroke="#fff" strokeWidth={2.5} strokeLinecap="round" fill="none"
                  />
                  <Circle cx={16} cy={16} r={2.5} fill="rgba(255,255,255,0.55)" />
                </Svg>
              </LinearGradient>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Brand name */}
        <Animated.Text entering={FadeInDown.delay(300).springify()} style={s.brand}>
          Burmalda
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text entering={FadeInDown.delay(450).duration(600)} style={s.tagline}>
          «Если я говорю сукин сын и сын шлюхи — это не одно и то же»
        </Animated.Text>

        {/* Feature list */}
        <Animated.View entering={FadeInUp.delay(600).springify()} style={s.features}>
          <FeatureItem color="#4361ee" text="Умные рекомендации DeepSeek" />
          <FeatureItem color="#7b2ff7" text="Моя волна — персональный микс" />
          <FeatureItem color="#00b4d8" text="Оффлайн — треки без интернета" />
        </Animated.View>

        {/* Button */}
        <Animated.View entering={FadeInUp.delay(750).springify()}>
          <Animated.View style={btnStyle}>
            <Pressable
              onPressIn={() => { btnScale.value = withSpring(0.96, { damping: 12 }); }}
              onPressOut={() => { btnScale.value = withSpring(1, { damping: 12 }); }}
              onPress={handleLogin}
              disabled={loading}
            >
              <LinearGradient
                colors={['#4361ee', '#7b2ff7', '#e040fb']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.btn}
              >
                {loading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : (
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
                        stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
                      />
                    </Svg>
                  )
                }
                <Text style={s.btnText}>
                  {loading ? 'Входим…' : 'Войти через NodeShift'}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </Animated.View>

        {!!error && (
          <Animated.Text entering={FadeIn} style={s.error}>{error}</Animated.Text>
        )}

        <Animated.Text entering={FadeIn.delay(900)} style={s.terms}>
          Продолжая, вы соглашаетесь с условиями NodeShift
        </Animated.Text>
      </View>
    </View>
  );
}

function FeatureItem({ color, text }: { color: string; text: string }) {
  return (
    <View style={s.featureRow}>
      <View style={[s.dot, { backgroundColor: color }]} />
      <Text style={s.featureText}>{text}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root:       { flex: 1 },

  orb1:       { position: 'absolute', width: 320, height: 320, top: -60, left: -100, borderRadius: 160, overflow: 'hidden', opacity: 0.2 },
  orb2:       { position: 'absolute', width: 260, height: 260, top: height * 0.2, right: -80, borderRadius: 130, overflow: 'hidden', opacity: 0.15 },
  orbGrad:    { flex: 1 },

  carousel:   { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.52, gap: 10, paddingTop: 56, overflow: 'hidden' },
  fadeBottom: { position: 'absolute', top: height * 0.35, left: 0, right: 0, height: height * 0.2 },
  fadeTop:    { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },

  content:    { flex: 1, justifyContent: 'flex-end', paddingBottom: 50, paddingHorizontal: 28 },

  logoRow:    { marginBottom: 18 },
  logoShadow: { shadowColor: '#7b2ff7', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.6, shadowRadius: 20 },
  logoBox:    { width: 62, height: 62, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  brand:      { fontSize: 46, fontWeight: '800', color: '#fff', letterSpacing: -2, marginBottom: 10, lineHeight: 50 },
  tagline:    { fontSize: 13, color: 'rgba(255,255,255,0.38)', fontWeight: '400', fontStyle: 'italic', marginBottom: 30, lineHeight: 19, letterSpacing: 0.1 },

  features:   { gap: 11, marginBottom: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot:        { width: 8, height: 8, borderRadius: 4 },
  featureText:{ color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: '500' },

  btn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 17, paddingHorizontal: 24, borderRadius: 17 },
  btnText:    { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  error:      { color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginTop: 12 },
  terms:      { color: 'rgba(255,255,255,0.25)', fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 17 },
});
