import { useEffect, useRef, useCallback } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { usePlayer } from '../store';

let _sound: Audio.Sound | null = null;

// Module-level singleton so the sound survives re-renders
export async function getSound() { return _sound; }

export function useAudio() {
  const initialized = useRef(false);
  const {
    queue, index, playing,
    setPlaying, setProgress, setDuration,
    nextTrack, setIndex, repeat,
  } = usePlayer();

  const currentTrack = queue[index] ?? null;

  // Init audio session once
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS:    true,
      interruptionModeIOS:     1,
      shouldDuckAndroid:       true,
    });
  }, []);

  // Load new track whenever index/id changes
  useEffect(() => {
    if (!currentTrack) return;

    const load = async () => {
      // Unload previous
      if (_sound) {
        await _sound.stopAsync().catch(() => {});
        await _sound.unloadAsync().catch(() => {});
        _sound = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: currentTrack.stream_url },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        (status: AVPlaybackStatus) => {
          if (!status.isLoaded) return;
          setProgress(status.positionMillis / 1000);
          setDuration((status.durationMillis ?? 0) / 1000);
          if (status.isPlaying !== usePlayer.getState().playing) {
            setPlaying(status.isPlaying);
          }
          if (status.didJustFinish) {
            const state = usePlayer.getState();
            const ni    = state.nextTrack();
            if (ni !== state.index || state.repeat === 2) {
              setIndex(ni);
            } else {
              setPlaying(false);
            }
          }
        },
      );
      _sound = sound;
    };

    load().catch(console.error);
  }, [currentTrack?.id]);

  const togglePlay = useCallback(async () => {
    if (!_sound) return;
    const status = await _sound.getStatusAsync();
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      await _sound.pauseAsync();
    } else {
      await _sound.playAsync();
    }
  }, []);

  const seek = useCallback(async (seconds: number) => {
    if (!_sound) return;
    await _sound.setPositionAsync(seconds * 1000);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      _sound?.unloadAsync().catch(() => {});
      _sound = null;
    };
  }, []);

  return { togglePlay, seek };
}
