import * as SecureStore from 'expo-secure-store';

const BASE      = 'https://music.nodeshift.space';
const CLOUD     = 'https://cloud.nodeshift.space';
const CLIENT_ID = 'nsc_A5zi4cZ103aYJGcNTG1bERXV1YCAQW_U';
const REDIRECT  = 'burmalda://auth/callback';

// ── Token storage ─────────────────────────────────────────────────────────────

export async function saveTokens(access: string, refresh: string) {
  await SecureStore.setItemAsync('access_token', access);
  await SecureStore.setItemAsync('refresh_token', refresh);
}
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync('access_token');
}
export async function clearTokens() {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

export async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const token = await getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers as Record<string, string> || {}),
  };
  return fetch(`${BASE}${path}`, { ...opts, headers });
}

// ── OAuth ─────────────────────────────────────────────────────────────────────

export function buildOAuthUrl(state: string): string {
  const p = new URLSearchParams({ client_id: CLIENT_ID, redirect_uri: REDIRECT, state, scope: 'profile email' });
  return `${CLOUD}/api/cloud/oauth/authorize?${p}`;
}

export async function exchangeCode(code: string): Promise<{ access_token: string; refresh_token: string; user: User }> {
  const res = await fetch(`${BASE}/api/auth/cloud-login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ code, redirect_uri: REDIRECT }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Auth failed');
  }
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Track {
  id:         number;
  title:      string;
  artist:     string;
  duration:   number;
  cover_url:  string | null;
  cdn_url:    string;
  cdn_url2:   string;
  filename:   string;
  album?:     string;
  play_count?: number;
  source?:    string;
  cdn_synced?: boolean;
}

export interface Album {
  id:          number;
  title:       string;
  artist:      string;
  cover_url:   string | null;
  track_count: number;
}

export interface User {
  id:         number;
  email:      string;
  username:   string | null;
  avatar_url: string | null;
  plan:       string;
}

export interface Lyrics {
  synced: string | null;
  plain:  string | null;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getTracks(): Promise<Track[]> {
  const r = await apiFetch('/api/music/tracks?limit=200');
  if (!r.ok) return [];
  return r.json();
}

export async function getAlbums(): Promise<Album[]> {
  const r = await apiFetch('/api/music/albums');
  if (!r.ok) return [];
  const data: Array<{ album: string; artist: string; count: number }> = await r.json();
  return data.map((a, i) => ({
    id:          i,
    title:       a.album,
    artist:      a.artist,
    cover_url:   null,
    track_count: a.count,
  }));
}

export async function getMe(): Promise<User | null> {
  // Validate token
  const r = await apiFetch('/api/auth/me');
  if (!r.ok) return null;
  const auth = await r.json();

  // Get music profile for username / avatar
  const pr = await apiFetch('/api/music/profile/me');
  const profile = pr.ok ? await pr.json() : {};

  return {
    id:         auth.id,
    email:      auth.email,
    username:   profile.username   || null,
    avatar_url: profile.avatar_url || null,
    plan:       'free', // merged with cached plan in useBootAuth
  };
}

export async function searchTracks(q: string): Promise<Track[]> {
  const r = await apiFetch('/api/music/tracks?limit=200');
  if (!r.ok) return [];
  const all: Track[] = await r.json();
  if (!q.trim()) return all;
  const lq = q.toLowerCase();
  return all.filter(t =>
    t.title.toLowerCase().includes(lq) ||
    t.artist.toLowerCase().includes(lq) ||
    (t.album && t.album.toLowerCase().includes(lq))
  );
}

export async function fetchLyrics(id: number): Promise<Lyrics | null> {
  const r = await apiFetch(`/api/music/lyrics/${id}`);
  if (!r.ok) return null;
  return r.json();
}

// cover_url from the server is one of:
//   - "https://cdn.nodeshift.space/music/xxx.jpg"  (full URL)
//   - "/api/music/cover/xxx.jpg"                   (relative path)
//   - "xxx.jpg"                                    (bare filename, legacy)
export function coverUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith('http')) return raw;
  if (raw.startsWith('/')) return `${BASE}${raw}`;
  return `${BASE}/api/music/cover/${raw}`;
}

// ── LRC parser ────────────────────────────────────────────────────────────────

export interface LrcLine {
  time: number;
  text: string;
}

export function parseLrc(lrc: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const raw of lrc.split('\n')) {
    const m = raw.match(/^\[(\d+):(\d+)\.(\d+)\]\s*(.*)$/);
    if (!m) continue;
    const time = parseInt(m[1]) * 60 + parseFloat(`${m[2]}.${m[3]}`);
    if (m[4].trim()) lines.push({ time, text: m[4].trim() });
  }
  return lines.sort((a, b) => a.time - b.time);
}
