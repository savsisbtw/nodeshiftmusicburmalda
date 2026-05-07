/**
 * app/auth/callback.tsx
 * Handles OAuth deep link: burmalda://auth/callback?code=...
 * expo-web-browser closes the session, then this page completes the flow.
 */
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Colors, Font } from '../../constants/theme';
import { exchangeCode, saveTokens } from '../../services/api';
import { useAuth } from '../../store';
import { saveUser } from '../../hooks/useAuth';

// Complete the auth session so expo-web-browser can close
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  const params = useLocalSearchParams<{ code?: string; error?: string }>();
  const { setUser } = useAuth();
  const [status, setStatus] = useState('Завершаем вход…');

  useEffect(() => {
    async function finish() {
      const code = params.code;
      if (!code) {
        const msg = params.error || 'Код авторизации отсутствует';
        setStatus(`Ошибка: ${msg}`);
        setTimeout(() => router.replace('/auth'), 2000);
        return;
      }
      try {
        const data = await exchangeCode(code);
        await saveTokens(data.access_token, data.refresh_token);
        await saveUser(data.user);
        setUser(data.user);
        router.replace('/(tabs)');
      } catch (e: any) {
        setStatus(`Ошибка: ${e.message || 'Не удалось войти'}`);
        setTimeout(() => router.replace('/auth'), 2500);
      }
    }
    finish();
  }, []);

  return (
    <View style={s.root}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={s.text}>{status}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg, alignItems: 'center', justifyContent: 'center', gap: 20 },
  text: { color: Colors.text, fontSize: Font.md, textAlign: 'center', opacity: 0.7 },
});
