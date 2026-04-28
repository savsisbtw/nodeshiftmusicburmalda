import * as SecureStore from 'expo-secure-store';

const BASE   = 'https://music.nodeshift.space';
const CLOUD  = 'https://cloud.nodeshift.space';
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

async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
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
  id: number;
  title: string;
  artist: string;
  duration: number;
  cover_url: string | null;
  stream_url: string;
  album?: string;
  plays?: number;
  liked?: boolean;
}

export interface Album {
  id: number;
  title: string;
  artist: string;
  cover_url: string | null;
  track_count: number;
}

export interface User {
  id: number;
  email: string;
  username: string | null;
  avatar_url: string | null;
  plan: string;
}

export interface Lyrics {
  synced: string | null;
  plain:  string | null;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function getTracks(): Promise<Track[]> {
  const r = await apiFetch('/api/music/tracks');
  if (!r.ok) return [];
  return r.json();
}

export async function getAlbums(): Promise<Album[]> {
  const r = await apiFetch('/api/music/albums');
  if (!r.ok) return [];
  return r.json();
}

export async function getMe(): Promise<User | null> {
  const r = await apiFetch('/api/music/profile/me');
  if (!r.ok) return null;
  return r.json();
}

export async function searchTracks(q: string): Promise<Track[]> {
  const r = await apiFetch(`/api/music/tracks?q=${encodeURIComponent(q)}`);
  if (!r.ok) return [];
  return r.json();
}

export async function fetchLyrics(id: number): Promise<Lyrics | null> {
  const r = await apiFetch(`/api/music/lyrics/${id}`);
  if (!r.ok) return null;
  return r.json();
}

export function streamUrl(filename: string): string {
  return `${BASE}/api/music/stream/${filename}`;
}

export function coverUrl(filename: string | null): string | null {
  if (!filename) return null;
  if (filename.startsWith('http')) return filename;
  return `${BASE}/api/music/cover/${filename}`;
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
