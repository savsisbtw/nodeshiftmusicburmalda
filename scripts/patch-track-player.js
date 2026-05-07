/**
 * Fix react-native-track-player broken npm package:
 * lib/src/trackPlayer.js is missing from the published tarball.
 * This script copies it from lib/web/ or creates a NativeModules shim.
 */
const fs   = require('fs');
const path = require('path');

const pkg    = path.join(__dirname, '..', 'node_modules', 'react-native-track-player');
const srcDir = path.join(pkg, 'lib', 'src');
const target = path.join(srcDir, 'trackPlayer.js');

console.log('[patch-track-player] lib/ contents:', fs.existsSync(path.join(pkg, 'lib'))
  ? fs.readdirSync(path.join(pkg, 'lib')).join(', ')
  : 'MISSING');

if (fs.existsSync(srcDir)) {
  console.log('[patch-track-player] lib/src/ contents:', fs.readdirSync(srcDir).join(', '));
}

if (fs.existsSync(target)) {
  console.log('[patch-track-player] trackPlayer.js already exists — skipping');
  process.exit(0);
}

// Priority 1: copy from lib/web/
const webFile = path.join(pkg, 'lib', 'web', 'trackPlayer.js');
if (fs.existsSync(webFile)) {
  fs.mkdirSync(srcDir, { recursive: true });
  fs.copyFileSync(webFile, target);
  console.log('[patch-track-player] Copied from lib/web/trackPlayer.js');
  process.exit(0);
}

// Priority 2: find any trackPlayer.js anywhere in the package
const findFile = (dir, name) => {
  if (!fs.existsSync(dir)) return null;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory()) {
      const r = findFile(full, name);
      if (r) return r;
    } else if (f.name === name) {
      return full;
    }
  }
  return null;
};

const found = findFile(path.join(pkg, 'lib'), 'trackPlayer.js');
if (found && found !== target) {
  fs.mkdirSync(srcDir, { recursive: true });
  fs.copyFileSync(found, target);
  console.log('[patch-track-player] Found and copied from:', found);
  process.exit(0);
}

// Priority 3: NativeModules shim (enough for expo prebuild + native bridge)
fs.mkdirSync(srcDir, { recursive: true });
fs.writeFileSync(target, `"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const react_native_1 = require("react-native");
const NTP = react_native_1.NativeModules.TrackPlayer || {};
const TrackPlayer = {
  setupPlayer: (options) => NTP.setupPlayer ? NTP.setupPlayer(options) : Promise.resolve(),
  add: (tracks, insertBeforeIndex) => NTP.add ? NTP.add(tracks, insertBeforeIndex) : Promise.resolve(),
  play: () => NTP.play ? NTP.play() : Promise.resolve(),
  pause: () => NTP.pause ? NTP.pause() : Promise.resolve(),
  stop: () => NTP.stop ? NTP.stop() : Promise.resolve(),
  reset: () => NTP.reset ? NTP.reset() : Promise.resolve(),
  seekTo: (seconds) => NTP.seekTo ? NTP.seekTo(seconds) : Promise.resolve(),
  skipToNext: () => NTP.skipToNext ? NTP.skipToNext() : Promise.resolve(),
  skipToPrevious: () => NTP.skipToPrevious ? NTP.skipToPrevious() : Promise.resolve(),
  getPlaybackState: () => NTP.getState ? NTP.getState() : Promise.resolve({ state: 0 }),
  updateOptions: (options) => NTP.updateOptions ? NTP.updateOptions(options) : Promise.resolve(),
  updateNowPlayingMetadata: (metadata) => NTP.updateNowPlayingMetadata ? NTP.updateNowPlayingMetadata(metadata) : Promise.resolve(),
  getQueue: () => NTP.getQueue ? NTP.getQueue() : Promise.resolve([]),
  getCurrentTrack: () => NTP.getCurrentTrack ? NTP.getCurrentTrack() : Promise.resolve(null),
  getVolume: () => NTP.getVolume ? NTP.getVolume() : Promise.resolve(1),
  setVolume: (level) => NTP.setVolume ? NTP.setVolume(level) : Promise.resolve(),
  getRate: () => NTP.getRate ? NTP.getRate() : Promise.resolve(1),
  setRate: (rate) => NTP.setRate ? NTP.setRate(rate) : Promise.resolve(),
  getProgress: () => NTP.getProgress ? NTP.getProgress() : Promise.resolve({ position: 0, duration: 0, buffered: 0 }),
};
exports.default = TrackPlayer;
Object.assign(exports, TrackPlayer);
`);
console.log('[patch-track-player] Created NativeModules shim — OK for prebuild');
process.exit(0);
