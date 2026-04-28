import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track, User } from '../services/api';

// ── Player ────────────────────────────────────────────────────────────────────

interface PlayerState {
  queue:      Track[];
  index:      number;
  playing:    boolean;
  progress:   number;
  duration:   number;
  repeat:     0 | 1 | 2;
  shuffle:    boolean;
  expanded:   boolean;

  setQueue:      (tracks: Track[], index?: number) => void;
  setIndex:      (i: number) => void;
  setPlaying:    (v: boolean) => void;
  setProgress:   (v: number) => void;
  setDuration:   (v: number) => void;
  cycleRepeat:   () => void;
  toggleShuffle: () => void;
  setExpanded:   (v: boolean) => void;
  nextTrack:     () => number;
  prevTrack:     () => number;
}

export const usePlayer = create<PlayerState>((set, get) => ({
  queue:    [],
  index:    -1,
  playing:  false,
  progress: 0,
  duration: 0,
  repeat:   0,
  shuffle:  false,
  expanded: false,

  setQueue:      (tracks, index = 0) => set({ queue: tracks, index }),
  setIndex:      (index) => set({ index }),
  setPlaying:    (playing) => set({ playing }),
  setProgress:   (progress) => set({ progress }),
  setDuration:   (duration) => set({ duration }),
  cycleRepeat:   () => set((s) => ({ repeat: ((s.repeat + 1) % 3) as 0 | 1 | 2 })),
  toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
  setExpanded:   (expanded) => set({ expanded }),

  nextTrack: () => {
    const { queue, index, shuffle, repeat } = get();
    if (repeat === 2) return index;
    if (shuffle) return Math.floor(Math.random() * queue.length);
    const next = index + 1;
    if (next >= queue.length) return repeat === 1 ? 0 : index;
    return next;
  },
  prevTrack: () => {
    const { queue, index, shuffle } = get();
    if (shuffle) return Math.floor(Math.random() * queue.length);
    return index - 1 < 0 ? queue.length - 1 : index - 1;
  },
}));

// ── Auth ──────────────────────────────────────────────────────────────────────

interface AuthState {
  user:     User | null;
  ready:    boolean;
  setUser:  (u: User | null) => void;
  setReady: (v: boolean) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user:     null,
  ready:    false,
  setUser:  (user) => set({ user }),
  setReady: (ready) => set({ ready }),
}));

// ── Likes ─────────────────────────────────────────────────────────────────────

const LIKES_KEY = 'ns-music-likes';

interface LikesState {
  likes:      Set<number>;
  loadLikes:  () => Promise<void>;
  toggleLike: (id: number) => void;
  isLiked:    (id: number) => boolean;
}

export const useLikes = create<LikesState>((set, get) => ({
  likes: new Set(),

  loadLikes: async () => {
    try {
      const raw = await AsyncStorage.getItem(LIKES_KEY);
      const arr: number[] = raw ? JSON.parse(raw) : [];
      set({ likes: new Set(arr) });
    } catch {}
  },

  toggleLike: (id) => {
    const next = new Set(get().likes);
    if (next.has(id)) next.delete(id); else next.add(id);
    set({ likes: next });
    AsyncStorage.setItem(LIKES_KEY, JSON.stringify([...next])).catch(() => {});
  },

  isLiked: (id) => get().likes.has(id),
}));
