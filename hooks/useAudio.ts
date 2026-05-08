import { useEffect } from 'react';
import TrackPlayer, {
  State,
  Capability,
  AppKilledPlaybackBehavior,
  usePlaybackState,
  useProgress,
} from 'react-native-track-player';
import { usePlayer } from '../store';
import { coverUrl, Track, getTrackUrl } from '../services/api';

let _setupDone    = false;
let _lastLoadedId: number | null = null;

async function ensureSetup() {
  if (_setupDone) return;
  try {
    await TrackPlayer.setupPlayer({
      minBuffer: 15,
      maxBuffer: 50,
      playBuffer: 2.5,
    });
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
        Capability.Stop,
      ],
      compactCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
      ],
      notificationCapabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
        Capability.SeekTo,
      ],
    });
    _setupDone = true;
  } catch (e: any) {
    // "already" means player was set up before (e.g. hot reload)
    if (e?.message?.toLowerCase().includes('already')) {
      _setupDone = true;
      return;
    }
    // Other errors — allow retry next call
    throw e;
  }
}

export async function loadAndPlay(track: Track) {
  if (_lastLoadedId === track.id) return;
  _lastLoadedId = track.id;
  try {
    const url = await getTrackUrl(track);
    await TrackPlayer.reset();
    await TrackPlayer.add({
      id:       String(track.id),
      url:      url || (track.cdn_url2 || track.cdn_url),
      title:    track.title,
      artist:   track.artist,
      // Pass artwork — TrackPlayer shows it on iOS lock screen & Now Playing
      artwork:  coverUrl(track.cover_url) ?? undefined,
      duration: track.duration,
      album:    track.album ?? undefined,
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
