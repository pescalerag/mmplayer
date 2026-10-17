const { withDangerousMod } = require('@expo/config-plugins');
const { generateImageAsync } = require('@expo/image-utils');
const fs = require('node:fs/promises');
const path = require('node:path');

// The dynamic icon plugin generates adaptive XML for API 26+, but no matching
// bitmap resource for API 24/25. Keep those aliases usable on older devices.
module.exports = function withAdaptiveIconFallbacks(config) {
  const entry = config.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === '@howincodes/expo-dynamic-app-icon'
  );
  const icons = entry?.[1] ?? {};

  return withDangerousMod(config, ['android', async (modConfig) => {
    const projectRoot = modConfig.modRequest.projectRoot;
    const res = path.join(modConfig.modRequest.platformProjectRoot, 'app/src/main/res');
    for (const [name, icon] of Object.entries(icons)) {
      if (typeof icon.android !== 'object' || !icon.android) continue;
      const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
      for (const [density, scale] of Object.entries({ mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 })) {
        const size = 48 * scale;
        const { source } = await generateImageAsync(
          { projectRoot, cacheType: `adaptive-icon-fallback-${safeName}-${density}` },
          {
            src: path.resolve(projectRoot, icon.ios),
            width: size,
            height: size,
            resizeMode: 'cover',
            removeTransparency: false,
            backgroundColor: 'transparent',
            borderRadius: size / 2,
          }
        );
        const folder = path.join(res, `mipmap-${density}`);
        await fs.mkdir(folder, { recursive: true });
        await fs.writeFile(path.join(folder, `ic_launcher_adaptive_${safeName}.png`), source);
      }
    }
    return modConfig;
  }]);
};
