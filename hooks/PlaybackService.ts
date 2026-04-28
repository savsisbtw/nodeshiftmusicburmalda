import TrackPlayer, { Event } from 'react-native-track-player';
import { usePlayer } from '../store';
import { loadAndPlay } from './useAudio';

export async function PlaybackService() {
  TrackPlayer.addEventListener(Event.RemotePlay,  () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());

  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    const state = usePlayer.getState();
    const ni    = state.nextTrack();
    state.setIndex(ni);
    const track = state.queue[ni];
    if (track) await loadAndPlay(track).catch(console.error);
  });

  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    const state    = usePlayer.getState();
    const progress = await TrackPlayer.getProgress();
    if (progress.position > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }
    const pi    = state.prevTrack();
    state.setIndex(pi);
    const track = state.queue[pi];
    if (track) await loadAndPlay(track).catch(console.error);
  });

  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) =>
    TrackPlayer.seekTo(position),
  );

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async () => {
    const state    = usePlayer.getState();
    const prevIdx  = state.index;

    if (state.repeat === 2) {
      await TrackPlayer.seekTo(0);
      await TrackPlayer.play();
      return;
    }

    const ni = state.nextTrack();
    state.setIndex(ni);

    if (ni === prevIdx) {
      state.setPlaying(false);
      return;
    }

    const track = state.queue[ni];
    if (track) await loadAndPlay(track).catch(console.error);
  });
}
