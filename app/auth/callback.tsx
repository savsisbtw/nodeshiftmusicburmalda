import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

// Complete the browser auth session so WebBrowser.openAuthSessionAsync returns
WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  useEffect(() => {
    // The actual code exchange is handled in auth.tsx via openAuthSessionAsync
    // This page only shows briefly if opened directly; redirect to auth
    const t = setTimeout(() => {
      router.replace('/auth');
    }, 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#07071a', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#4361ee" size="large" />
    </View>
  );
}
