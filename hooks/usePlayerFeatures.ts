/**
 * useNextTrackPreload — preloads next track URL 30s before end
 * useDownloadQueue    — sequential download queue (one at a time)
 * useDynamicColor     — extracts dominant color from cover art
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { ImageColors } from 'react-native-image-colors';
import * as FileSystem from 'expo-file-system';
import TrackPlayer from 'react-native-track-player';
import { usePlayer, useOffline } from '../store';
import { coverUrl, getTrackUrl, Track } from '../services/api';

// ── Dynamic color from cover ──────────────────────────────────────────────────

const colorCache = new Map<string, string>();

export function useDynamicColor(coverUri: string | null): string {
  const [color, setColor] = useState('#1a1a2e');

  useEffect(() => {
    if (!coverUri) { setColor('#1a1a2e'); return; }
    if (colorCache.has(coverUri)) { setColor(colorCache.get(coverUri)!); return; }

    try {
      ImageColors.getColors(coverUri, {
        fallback: '#1a1a2e',
        cache: true,
        key: coverUri,
      }).then((result) => {
        let picked = '#1a1a2e';
        if (result.platform === 'ios') {
          picked = result.primary ?? result.background ?? picked;
        } else if (result.platform === 'android') {
          picked = result.vibrant ?? result.dominant ?? picked;
        }
        colorCache.set(coverUri, picked);
        setColor(picked);
      }).catch(() => {});
    } catch {
      // Native module not available — silently skip
    }
  }, [coverUri]);

  return color;
}

// ── Preload next track ────────────────────────────────────────────────────────

export function useNextTrackPreload() {
  const { queue, index, progress, duration } = usePlayer();
  const preloadedId = useRef<number | null>(null);

  useEffect(() => {
    const next = queue[index + 1];
    if (!next) return;
    if (preloadedId.current === next.id) return;

    const timeLeft = duration - progress;
    if (timeLeft > 30 || timeLeft <= 0) return;

    preloadedId.current = next.id;
    // Prefetch the URL so it's in the network cache
    getTrackUrl(next).then((url) => {
      if (url?.startsWith('http')) {
        fetch(url, { method: 'HEAD' }).catch(() => {});
      }
    }).catch(() => {});
  }, [Math.floor(progress), index]);
}

// ── Sequential download queue ─────────────────────────────────────────────────

const DL_DIR = FileSystem.documentDirectory + 'tracks/';

interface QueueItem { track: Track; }

const downloadQueue: QueueItem[] = [];
let isProcessing = false;

async function processQueue(
  setDownloading: (id: number, p: number) => void,
  addDownloaded: (id: number) => void,
  downloadedTracks: Set<number>,
) {
  if (isProcessing || downloadQueue.length === 0) return;
  isProcessing = true;

  while (downloadQueue.length > 0) {
    const item = downloadQueue[0];
    const { track } = item;

    if (downloadedTracks.has(track.id)) {
      downloadQueue.shift();
      continue;
    }

    try {
      const info = await FileSystem.getInfoAsync(DL_DIR);
      if (!info.exists) await FileSystem.makeDirectoryAsync(DL_DIR, { intermediates: true });

      const url = track.cdn_url || track.cdn_url2;
      if (!url) { downloadQueue.shift(); continue; }

      const ext = (track.filename?.split('.').pop() || 'mp3');
      const localPath = `${DL_DIR}${track.id}.${ext}`;
      setDownloading(track.id, 0.01);

      const dl = FileSystem.createDownloadResumable(url, localPath, {}, (dp) => {
        const pct = dp.totalBytesExpectedToWrite > 0
          ? dp.totalBytesWritten / dp.totalBytesExpectedToWrite : 0;
        setDownloading(track.id, pct);
      });

      const result = await dl.downloadAsync();
      if (result?.uri) {
        addDownloaded(track.id);
        setDownloading(track.id, 1);
        await FileSystem.writeAsStringAsync(`${DL_DIR}${track.id}.json`, JSON.stringify({
          id: track.id, title: track.title, artist: track.artist,
          filename: track.filename, cover_url: track.cover_url, localPath: result.uri,
        }));
      }
    } catch {
      setDownloading(track.id, 1);
    }

    downloadQueue.shift();
  }

  isProcessing = false;
}

export function useDownloadQueue() {
  const { setDownloading, addDownloadedTrack, downloadedTracks } = useOffline();

  const enqueue = useCallback((track: Track) => {
    if (downloadedTracks.has(track.id)) return;
    if (downloadQueue.some(i => i.track.id === track.id)) return;
    downloadQueue.push({ track });
    processQueue(setDownloading, addDownloadedTrack, downloadedTracks);
  }, [downloadedTracks, setDownloading, addDownloadedTrack]);

  const enqueueAll = useCallback((tracks: Track[]) => {
    tracks.forEach(enqueue);
  }, [enqueue]);

  return { enqueue, enqueueAll, queueLength: downloadQueue.length };
}
