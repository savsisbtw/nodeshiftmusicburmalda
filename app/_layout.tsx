import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useBootAuth } from '../hooks/useAuth';
import { Colors } from '../constants/theme';

// Must be defined before use — hooks are not hoisted
function useOTAUpdates() {
  useEffect(() => {
    if (__DEV__) return;
    // Lazy import so expo-updates crash doesn't kill the app
    (async () => {
      try {
        const Updates = await import('expo-updates');
        const check = await Updates.checkForUpdateAsync();
        if (check.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch {
        // Silently ignore — OTA is optional
      }
    })();
  }, []);
}

export default function RootLayout() {
  useBootAuth();
  useOTAUpdates();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bg }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" options={{ presentation: 'fullScreenModal' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}
