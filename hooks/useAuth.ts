import { useEffect } from 'react';
import { getAccessToken, getMe, clearTokens } from '../services/api';
import { useAuth } from '../store';

export function useBootAuth() {
  const { setUser, setReady } = useAuth();

  useEffect(() => {
    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) { setReady(true); return; }
        const me = await getMe();
        setUser(me);
      } catch {
        // ignore
      } finally {
        setReady(true);
      }
    })();
  }, []);
}

export async function logout() {
  await clearTokens();
  useAuth.getState().setUser(null);
}
