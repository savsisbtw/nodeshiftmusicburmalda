/**
 * Rewrites react-native-track-player/app.plugin.js to pure CommonJS
 * to avoid broken lib/src imports during expo prebuild
 */
const fs   = require('fs');
const path = require('path');

const pluginPath = path.join(__dirname, '..', 'node_modules', 'react-native-track-player', 'app.plugin.js');

if (!fs.existsSync(path.dirname(pluginPath))) {
  console.log('[fix-plugin] node_modules/react-native-track-player not found — skipping');
  process.exit(0);
}

const content = `const { withInfoPlist } = require('@expo/config-plugins');
module.exports = function withTrackPlayer(config) {
  return withInfoPlist(config, function(cfg) {
    if (!cfg.modResults.UIBackgroundModes) {
      cfg.modResults.UIBackgroundModes = [];
    }
    if (!cfg.modResults.UIBackgroundModes.includes('audio')) {
      cfg.modResults.UIBackgroundModes.push('audio');
    }
    return cfg;
  });
};
`;

fs.writeFileSync(pluginPath, content);
console.log('[fix-plugin] app.plugin.js rewritten OK');
