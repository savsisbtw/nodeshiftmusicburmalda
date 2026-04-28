import { useEffect } from 'react';
import TrackPlayer, {
  State,
  Capability,
  AppKilledPlaybackBehavior,
  usePlaybackState,
  useProgress,
} from 'react-native-track-player';
import { usePlayer } from '../store';
import { coverUrl, Track } from '../services/api';

let _setupDone    = false;
let _lastLoadedId: number | null = null;

async function ensureSetup() {
  if (_setupDone) return;
  _setupDone = true;
  try {
    await TrackPlayer.setupPlayer({ minBuffer: 15, maxBuffer: 50, playBuffer: 2.5 });
    await TrackPlayer.updateOptions({
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SkipToNext],
    });
  } catch (e: any) {
    // Player already set up on hot reload — update options only
    if (e?.message?.toLowerCase().includes('already')) {
      _setupDone = true;
      return;
    }
    _setupDone = false;
    throw e;
  }
}

// Load a track and start playing. Mutex prevents double-load on the same ID.
export async function loadAndPlay(track: Track) {
  if (_lastLoadedId === track.id) return;
  _lastLoadedId = track.id;
  try {
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id:       String(track.id),
      url:      track.cdn_url2 || track.cdn_url,
      title:    track.title,
      artist:   track.artist,
      artwork:  coverUrl(track.cover_url) ?? undefined,
      duration: track.duration,
    });
    await TrackPlayer.play();
  } catch (e) {
    _lastLoadedId = null;
    throw e;
  }
}

export async function togglePlay() {
  const { state } = await TrackPlayer.getPlaybackState();
  if (state === State.Playing) await TrackPlayer.pause();
  else await TrackPlayer.play();
}

export async function seekTo(seconds: number) {
  await TrackPlayer.seekTo(seconds);
}

// Call ONCE from the root layout only
export function useAudio() {
  const { queue, index, setPlaying, setProgress, setDuration } = usePlayer();
  const currentTrack  = queue[index] ?? null;
  const playbackState = usePlaybackState();
  const progress      = useProgress(500);

  // One-time player setup
  useEffect(() => {
    ensureSetup().catch(console.error);
  }, []);

  // Sync TrackPlayer progress → store
  useEffect(() => {
    setProgress(progress.position);
    setDuration(progress.duration);
  }, [progress.position, progress.duration]);

  // Sync TrackPlayer playing state → store
  useEffect(() => {
    setPlaying(playbackState.state === State.Playing);
  }, [playbackState.state]);

  // Load new track when queue index changes
  useEffect(() => {
    if (!currentTrack) return;
    loadAndPlay(currentTrack).catch(console.error);
  }, [currentTrack?.id]);

  return { togglePlay, seek: seekTo };
}
