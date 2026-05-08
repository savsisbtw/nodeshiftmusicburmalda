import 'expo-router/entry';

// Register TrackPlayer background service safely
// Must be wrapped — if native module isn't ready, app would white-screen otherwise
try {
  const TP = require('react-native-track-player');
  const TrackPlayer = TP.default ?? TP;
  const { PlaybackService } = require('./hooks/PlaybackService');
  if (TrackPlayer?.registerPlaybackService && typeof PlaybackService === 'function') {
    TrackPlayer.registerPlaybackService(() => PlaybackService);
  }
} catch (e) {
  // TrackPlayer native module not ready yet — skip service registration
  // Music playback via TrackPlayer will still work, just no remote controls
  console.warn('[TrackPlayer] registerPlaybackService failed:', e?.message);
}
