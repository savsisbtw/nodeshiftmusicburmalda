import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  Dimensions, ScrollView,
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withSpring, withTiming,
  withRepeat, withSequence, FadeIn, FadeInDown, FadeInUp,
  interpolate, Extrapolate, withDelay, Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Path, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Colors, Font } from '../constants/theme';
import { buildOAuthUrl, exchangeCode, saveTokens } from '../services/api';
import { useAuth } from '../store';
import { saveUser } from '../hooks/useAuth';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

// Fake album-like gradient cards for the carousel
const CARDS = [
  ['#1a1a5e', '#3a0ca3'],
  ['#0d1b2a', '#1b4332'],
  ['#2d0a3a', '#7b2d8b'],
  ['#1a0a00', '#7c3f00'],
  ['#001b33', '#003d73'],
  ['#1a1a3e', '#4a0080'],
  ['#0a1a00', '#1a4a00'],
  ['#2a0010', '#6a0030'],
  ['#001a2a', '#004a5a'],
];

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { setUser } = useAuth();

  // Button animation
  const btnScale  = useSharedValue(1);
  const btnGlow   = useSharedValue(0);

  // Orb animations
  const orb1X = useSharedValue(0);
  const orb1Y = useSharedValue(0);
  const orb2X = useSharedValue(0);
  const orb2Y = useSharedValue(0);
  const orb3X = useSharedValue(0);

  // Title word stagger
  const titleOpacity = useSharedValue(0);
  const titleY       = useSharedValue(30);

  useEffect(() => {
    // Orb 1 - slow drift
    orb1X.value = withRepeat(
      withSequence(
        withTiming(40,  { duration: 9000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-30, { duration: 9000, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    );
    orb1Y.value = withRepeat(
      withSequence(
        withTiming(-50, { duration: 7000, easing: Easing.inOut(Easing.sin) }),
        withTiming(30,  { duration: 7000, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    );
    // Orb 2
    orb2X.value = withRepeat(
      withSequence(
        withTiming(-60, { duration: 11000, easing: Easing.inOut(Easing.sin) }),
        withTiming(40,  { duration: 11000, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    );
    orb2Y.value = withRepeat(
      withSequence(
        withTiming(60,  { duration: 8000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-40, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    );
    // Orb 3
    orb3X.value = withRepeat(
      withSequence(
        withTiming(50,  { duration: 13000, easing: Easing.inOut(Easing.sin) }),
        withTiming(-35, { duration: 13000, easing: Easing.inOut(Easing.sin) }),
      ), -1, true,
    );

    // Title entrance
    titleOpacity.value = withDelay(300, withTiming(1, { duration: 900 }));
    titleY.value       = withDelay(300, withSpring(0, { damping: 18, stiffness: 80 }));

    // Button glow pulse
    btnGlow.value = withDelay(1200, withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ), -1, false,
    ));
  }, []);

  const orb1Style = useAnimatedStyle(() => ({
    transform: [{ translateX: orb1X.value }, { translateY: orb1Y.value }],
  }));
  const orb2Style = useAnimatedStyle(() => ({
    transform: [{ translateX: orb2X.value }, { translateY: orb2Y.value }],
  }));
  const orb3Style = useAnimatedStyle(() => ({
    transform: [{ translateX: orb3X.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(btnGlow.value, [0, 1], [0.35, 0.75], Extrapolate.CLAMP),
    transform: [{ scale: interpolate(btnGlow.value, [0, 1], [1, 1.08], Extrapolate.CLAMP) }],
  }));

  const handleLogin = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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
    <View style={s.root}>
      {/* Deep dark base */}
      <LinearGradient
        colors={['#070711', '#0d0d1f', '#070711']}
        style={StyleSheet.absoluteFill}
      />

      {/* Animated color orbs */}
      <Animated.View style={[s.orb, s.orb1, orb1Style]} pointerEvents="none">
        <LinearGradient colors={['#3a0ca3', '#4361ee']} style={s.orbInner} />
      </Animated.View>
      <Animated.View style={[s.orb, s.orb2, orb2Style]} pointerEvents="none">
        <LinearGradient colors={['#7b2ff7', '#e040fb']} style={s.orbInner} />
      </Animated.View>
      <Animated.View style={[s.orb, s.orb3, orb3Style]} pointerEvents="none">
        <LinearGradient colors={['#00b4d8', '#0077b6']} style={s.orbInner} />
      </Animated.View>

      {/* Album cards carousel — auto scroll */}
      <View style={s.carouselWrap} pointerEvents="none">
        <AutoScrollRow reverse={false} speed={35} />
        <AutoScrollRow reverse={true}  speed={28} />
        <AutoScrollRow reverse={false} speed={40} />
      </View>

      {/* Gradient fade over carousel */}
      <LinearGradient
        colors={['#070711', 'transparent', 'transparent', '#070711']}
        locations={[0, 0.15, 0.75, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Bottom gradient */}
      <LinearGradient
        colors={['transparent', '#070711']}
        style={[StyleSheet.absoluteFill, { top: height * 0.45 }]}
        pointerEvents="none"
      />

      {/* Content */}
      <View style={s.content}>
        {/* Logo */}
        <Animated.View style={[s.logoWrap, titleStyle]}>
          <Animated.View style={[s.logoIconWrap, glowStyle]}>
            <LinearGradient
              colors={['#4361ee', '#7b2ff7', '#e040fb']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.logoIcon}
            >
              {/* Abstract waveform / sound lines — no music note */}
              <Svg width={34} height={34} viewBox="0 0 34 34" fill="none">
                <Path d="M4 17 Q8 8, 12 17 Q16 26, 20 17 Q24 8, 30 17"
                  stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <Circle cx={17} cy={17} r={2.5} fill="rgba(255,255,255,0.6)" />
              </Svg>
            </LinearGradient>
          </Animated.View>
        </Animated.View>

        <Animated.Text style={[s.brand, titleStyle]}>Burmalda</Animated.Text>

        <Animated.View entering={FadeInDown.delay(500).springify()}>
          <Text style={s.tagline}>Твоя музыка. Твой ритм.</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(700).springify()} style={s.features}>
          <FeatureRow icon="wave"   text="Умные рекомендации" delay={800} />
          <FeatureRow icon="cloud"  text="Оффлайн доступ" delay={950} />
          <FeatureRow icon="heart"  text="Ваша волна" delay={1100} />
        </Animated.View>

        {/* Login button */}
        <Animated.View entering={FadeInUp.delay(900).springify()} style={s.btnArea}>
          <Animated.View style={btnStyle}>
            <Pressable
              onPressIn={() => { btnScale.value = withSpring(0.96, { damping: 12 }); }}
              onPressOut={() => { btnScale.value = withSpring(1,    { damping: 12 }); }}
              onPress={handleLogin}
              disabled={loading}
              style={s.btnOuter}
            >
              <LinearGradient
                colors={['#4361ee', '#7b2ff7', '#e040fb']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={s.btn}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                    <Path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"
                      stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                )}
                <Text style={s.btnText}>
                  {loading ? 'Входим…' : 'Войти через NodeShift'}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>

          {!!error && (
            <Animated.Text entering={FadeIn} style={s.error}>{error}</Animated.Text>
          )}

          <Animated.Text entering={FadeIn.delay(1200)} style={s.terms}>
            Продолжая, вы соглашаетесь с условиями NodeShift
          </Animated.Text>
        </Animated.View>
      </View>
    </View>
  );
}

// ── Auto-scrolling card row ────────────────────────────────────────────────────

function AutoScrollRow({ reverse, speed }: { reverse: boolean; speed: number }) {
  const scrollRef = useRef<ScrollView>(null);
  const offset    = useRef(0);
  const maxScroll = useRef(CARDS.length * 90);

  useEffect(() => {
    const interval = setInterval(() => {
      offset.current = reverse
        ? offset.current <= 0 ? maxScroll.current : offset.current - 0.8
        : offset.current >= maxScroll.current ? 0 : offset.current + 0.8;
      scrollRef.current?.scrollTo({ x: offset.current, animated: false });
    }, speed / 10);
    return () => clearInterval(interval);
  }, []);

  const doubled = [...CARDS, ...CARDS, ...CARDS];

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      scrollEnabled={false}
      showsHorizontalScrollIndicator={false}
      style={s.cardRow}
    >
      {doubled.map((colors, i) => (
        <GradientCard key={i} colors={colors as [string, string]} />
      ))}
    </ScrollView>
  );
}

function GradientCard({ colors }: { colors: [string, string] }) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.card} />
  );
}

// ── Feature row item ──────────────────────────────────────────────────────────

function FeatureRow({ icon, text, delay }: { icon: string; text: string; delay: number }) {
  const icons: Record<string, JSX.Element> = {
    wave: (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M2 12 Q5 4, 8 12 Q11 20, 14 12 Q17 4, 22 12"
          stroke={Colors.accent} strokeWidth={2} strokeLinecap="round" fill="none" />
      </Svg>
    ),
    cloud: (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"
          stroke={Colors.accent} strokeWidth={2} strokeLinecap="round" />
      </Svg>
    ),
    heart: (
      <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
        <Path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z"
          stroke={Colors.accent} strokeWidth={2} strokeLinejoin="round" />
      </Svg>
    ),
  };

  return (
    <Animated.View entering={FadeInDown.delay(delay).springify()} style={s.featureRow}>
      <View style={s.featureIcon}>{icons[icon]}</View>
      <Text style={s.featureText}>{text}</Text>
    </Animated.View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_W = 76;
const CARD_H = 76;

const s = StyleSheet.create({
  root:        { flex: 1, backgroundColor: '#070711' },

  // Orbs
  orb:         { position: 'absolute', borderRadius: 999 },
  orbInner:    { flex: 1, borderRadius: 999 },
  orb1:        { width: 340, height: 340, top: -80, left: -100, opacity: 0.22 },
  orb2:        { width: 280, height: 280, top: height * 0.25, right: -80, opacity: 0.18 },
  orb3:        { width: 200, height: 200, bottom: height * 0.3, left: -60, opacity: 0.14 },

  // Carousel
  carouselWrap: { position: 'absolute', top: 0, left: 0, right: 0, height: height * 0.55, gap: 10, paddingTop: 60, overflow: 'hidden' },
  cardRow:      { flexGrow: 0, paddingHorizontal: 8 },
  card:         { width: CARD_W, height: CARD_H, borderRadius: 14, marginHorizontal: 5, opacity: 0.7 },

  // Content
  content:     { flex: 1, justifyContent: 'flex-end', paddingBottom: 48, paddingHorizontal: 28 },
  logoWrap:    { alignItems: 'flex-start', marginBottom: 16 },
  logoIconWrap:{ alignSelf: 'flex-start' },
  logoIcon:    { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  brand:       { fontSize: 48, fontWeight: '800', color: '#fff', letterSpacing: -2, marginBottom: 8, lineHeight: 52 },
  tagline:     { fontSize: 18, color: 'rgba(255,255,255,0.55)', fontWeight: '500', marginBottom: 32, letterSpacing: -0.3 },

  // Features
  features:    { gap: 12, marginBottom: 36 },
  featureRow:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(67,97,238,0.15)', alignItems: 'center', justifyContent: 'center' },
  featureText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '500' },

  // Button
  btnArea:     { gap: 16 },
  btnOuter:    { borderRadius: 18, overflow: 'hidden', shadowColor: '#7b2ff7', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.5, shadowRadius: 24 },
  btn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 18, paddingHorizontal: 24 },
  btnText:     { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  error:       { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },
  terms:       { color: 'rgba(255,255,255,0.28)', fontSize: 12, textAlign: 'center', lineHeight: 18 },
});
