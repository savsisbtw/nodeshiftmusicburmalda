import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAccessToken, getMe, clearTokens, User } from '../services/api';
import { useAuth } from '../store';

const USER_KEY = 'ns-music-user';

export async function saveUser(user: User): Promise<void> {
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
}

export async function loadCachedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function useBootAuth() {
  const { setUser, setReady } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) { setReady(true); return; }

        // Use cached user for immediate display while validating
        const cached = await loadCachedUser();
        if (cached) setUser(cached);

        // Validate token and get fresh data
        const me = await getMe();
        if (me) {
          // Preserve plan from initial login since no endpoint exposes it
          const merged: User = { ...me, plan: cached?.plan || me.plan };
          setUser(merged);
          saveUser(merged).catch(() => {});
        } else {
          // Token invalid — clear everything
          await clearTokens();
          await AsyncStorage.removeItem(USER_KEY);
          setUser(null);
        }
      } catch {
        // Network error — cached user already set above, just mark ready
      } finally {
        setReady(true);
      }
    })();
  }, []);
}

export async function logout() {
  await clearTokens();
  await AsyncStorage.removeItem(USER_KEY).catch(() => {});
  useAuth.getState().setUser(null);
}
