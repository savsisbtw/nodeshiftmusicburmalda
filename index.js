import 'expo-router/entry';

// Register TrackPlayer background service safely
// Must be wrapped — if native module isn't ready, app would white-screen otherwise
try {
  const TrackPlayer = require('react-native-track-player').default;
  const { PlaybackService } = require('./hooks/PlaybackService');
  TrackPlayer.registerPlaybackService(() => PlaybackService);
} catch (e) {
  // TrackPlayer native module not ready yet — skip service registration
  // Music playback via TrackPlayer will still work, just no remote controls
  console.warn('[TrackPlayer] registerPlaybackService failed:', e?.message);
}
