import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator, Image, Dimensions
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/theme';
import { buildOAuthUrl, exchangeCode, saveTokens } from '../../services/api';
import { useAuth } from '../../store';
import { saveUser } from '../../hooks/useAuth';

WebBrowser.maybeCompleteAuthSession();

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useAuth();

  const handleLogin = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setLoading(true);
    setError('');
    try {
      const state = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      const url = buildOAuthUrl(state);
      const result = await WebBrowser.openAuthSessionAsync(url, 'burmalda://auth/callback');
      if (result.type !== 'success') { setError('Авторизация отменена'); return; }
      const parsed = Linking.parse(result.url);
      const code = parsed.queryParams?.code as string | undefined;
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
      {/* Sleek dark background */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: '#050505' }]} />
      
      {/* Modern gradient accent for nodeshiftmusic style */}
      <Animated.View entering={FadeIn.duration(1000)} style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={['rgba(67, 97, 238, 0.1)', 'rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0)']}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={s.content}>
        <Animated.View entering={FadeInDown.delay(200).springify()} style={s.logoContainer}>
          <Image 
            source={require('../../assets/icon.png')} 
            style={s.logo} 
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.Text entering={FadeInDown.delay(300).springify()} style={s.brand}>
          NodeShift
        </Animated.Text>
        
        <Animated.Text entering={FadeInDown.delay(400).springify()} style={s.subtitle}>
          Музыкальная экосистема
        </Animated.Text>

        <Animated.View entering={FadeInUp.delay(500).springify()} style={s.btnWrapper}>
          <Pressable
            style={({ pressed }) => [
              s.btn,
              pressed && s.btnPressed
            ]}
            onPress={handleLogin}
            disabled={loading}
          >
            <LinearGradient
              colors={['#4361ee', '#3a0ca3']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={s.btnGradient}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.btnText}>Войти</Text>
              )}
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {!!error && (
          <Animated.Text entering={FadeIn} style={s.error}>{error}</Animated.Text>
        )}

        <Animated.Text entering={FadeIn.delay(700)} style={s.terms}>
          Продолжая, вы соглашаетесь с условиями NodeShift
        </Animated.Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, paddingBottom: 40 },
  logoContainer: {
    width: 140,
    height: 140,
    marginBottom: 24,
    shadowColor: '#4361ee',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  brand: {
    fontSize: 36,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.5)',
    marginBottom: 56,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  btnWrapper: {
    width: '100%',
    maxWidth: 320,
    shadowColor: '#4361ee',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  btn: {
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  btnGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
  btnText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  error: {
    color: '#ff4757',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    fontWeight: '500',
  },
  terms: {
    position: 'absolute',
    bottom: 40,
    color: 'rgba(255, 255, 255, 0.3)',
    fontSize: 12,
    textAlign: 'center',
  },
});
