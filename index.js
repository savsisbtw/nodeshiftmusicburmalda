import 'expo-router/entry';
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './hooks/PlaybackService';

TrackPlayer.registerPlaybackService(() => PlaybackService);
