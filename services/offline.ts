import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Track, Album } from './api';

const OFFLINE_TRACKS_KEY  = 'offline_tracks_cache';
const OFFLINE_ALBUMS_KEY  = 'offline_albums_cache';
const DOWNLOADED_TRACKS_KEY = 'downloaded_tracks';

const DOCUMENTS_DIR = `${FileSystem.documentDirectory}music/`;

// ── Initialization ─────────────────────────────────────────────────────────────

export async function initOfflineStorage() {
  try {
    const dir = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
    if (!dir.exists) {
      await FileSystem.makeDirectoryAsync(DOCUMENTS_DIR, { intermediates: true });
    }
  } catch (err) {
    console.warn('Failed to create offline storage dir:', err);
  }
}

// ── Cache management ───────────────────────────────────────────────────────────

export async function cacheTracksAndAlbums(tracks: Track[], albums: Album[]) {
  try {
    await Promise.all([
      AsyncStorage.setItem(OFFLINE_TRACKS_KEY, JSON.stringify(tracks)),
      AsyncStorage.setItem(OFFLINE_ALBUMS_KEY, JSON.stringify(albums)),
    ]);
  } catch (err) {
    console.warn('Failed to cache tracks and albums:', err);
  }
}

export async function getCachedTracks(): Promise<Track[] | null> {
  try {
    const cached = await AsyncStorage.getItem(OFFLINE_TRACKS_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.warn('Failed to get cached tracks:', err);
    return null;
  }
}

export async function getCachedAlbums(): Promise<Album[] | null> {
  try {
    const cached = await AsyncStorage.getItem(OFFLINE_ALBUMS_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    console.warn('Failed to get cached albums:', err);
    return null;
  }
}

// ── Downloaded tracks management ───────────────────────────────────────────────

export async function getDownloadedTracks(): Promise<number[]> {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADED_TRACKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addDownloadedTrack(trackId: number) {
  try {
    const ids = await getDownloadedTracks();
    if (!ids.includes(trackId)) {
      ids.push(trackId);
      await AsyncStorage.setItem(DOWNLOADED_TRACKS_KEY, JSON.stringify(ids));
    }
  } catch (err) {
    console.warn('Failed to add downloaded track:', err);
  }
}

export async function removeDownloadedTrack(trackId: number) {
  try {
    let ids = await getDownloadedTracks();
    ids = ids.filter(id => id !== trackId);
    await AsyncStorage.setItem(DOWNLOADED_TRACKS_KEY, JSON.stringify(ids));
  } catch (err) {
    console.warn('Failed to remove downloaded track:', err);
  }
}

export function getTrackFilePath(trackId: number): string {
  return `${DOCUMENTS_DIR}track_${trackId}.mp3`;
}

export async function isTrackDownloaded(trackId: number): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(getTrackFilePath(trackId));
    return info.exists;
  } catch {
    return false;
  }
}

// ── Track download ───────────────────────────────────────────────────────────

export interface DownloadProgress {
  trackId: number;
  progress: number;
  loaded: number;
  total: number;
}

export async function downloadTrack(
  track: Track,
  onProgress?: (progress: DownloadProgress) => void
): Promise<boolean> {
  try {
    const filePath = getTrackFilePath(track.id);
    const uri = track.cdn_url || track.cdn_url2;

    if (!uri) {
      console.warn('No download URL for track:', track.id);
      return false;
    }

    // Check if already downloaded
    if (await isTrackDownloaded(track.id)) {
      await addDownloadedTrack(track.id);
      return true;
    }

    // Download with progress tracking
    const downloadResumable = FileSystem.createDownloadResumable(
      uri,
      filePath,
      {},
      (progress) => {
        const { totalBytesWritten, totalBytesExpectedToDownload } = progress;
        onProgress?.({
          trackId: track.id,
          progress: totalBytesWritten / totalBytesExpectedToDownload,
          loaded: totalBytesWritten,
          total: totalBytesExpectedToDownload,
        });
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (result?.uri) {
      await addDownloadedTrack(track.id);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Failed to download track:', err);
    return false;
  }
}

export async function deleteTrack(trackId: number): Promise<boolean> {
  try {
    const filePath = getTrackFilePath(trackId);
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      await FileSystem.deleteAsync(filePath);
      await removeDownloadedTrack(trackId);
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Failed to delete track:', err);
    return false;
  }
}

export async function getStorageInfo(): Promise<{ used: number; total: number } | null> {
  try {
    const info = await FileSystem.getInfoAsync(DOCUMENTS_DIR);
    if (!info.exists) return null;
    
    // Get all files
    const files = await FileSystem.readDirectoryAsync(DOCUMENTS_DIR);
    let used = 0;
    
    for (const file of files) {
      const fileInfo = await FileSystem.getInfoAsync(`${DOCUMENTS_DIR}${file}`);
      if (fileInfo.size) used += fileInfo.size;
    }

    return { used, total: 5 * 1024 * 1024 * 1024 }; // 5GB limit
  } catch {
    return null;
  }
}
