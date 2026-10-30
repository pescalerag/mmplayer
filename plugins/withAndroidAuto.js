const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

const attributionIcon = `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp" android:viewportWidth="512" android:viewportHeight="512">
    <path android:fillColor="#FFFFFFFF" android:pathData="M53,373 L97,132 L216,132 L248,289 L342,132 L457,132 L409,373 L320,373 L359,178 L250,373 L205,373 L156,168 L119,373 Z" />
</vector>
`;

module.exports = function withAndroidAuto(config) {
  config = withAndroidManifest(config, mod => {
    const app = mod.modResults.manifest.application[0];
    app['meta-data'] ??= [];
    const metadata = [
      ['com.google.android.gms.car.application', '@xml/automotive_app_desc'],
      ['androidx.car.app.TintableAttributionIcon', '@drawable/ic_android_auto'],
    ];
    for (const [name, resource] of metadata) {
      const existing = app['meta-data'].find(item => item.$['android:name'] === name);
      if (existing) {
        existing.$['android:resource'] = resource;
      } else {
        app['meta-data'].push({ $: { 'android:name': name, 'android:resource': resource } });
      }
    }
    return mod;
  });
  return withDangerousMod(config, ['android', async mod => {
    const directory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, 'automotive_app_desc.xml'), '<automotiveApp><uses name="media" /></automotiveApp>\n');
    const drawableDirectory = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
    await fs.mkdir(drawableDirectory, { recursive: true });
    await fs.writeFile(path.join(drawableDirectory, 'ic_android_auto.xml'), attributionIcon);
    return mod;
  }]);
};
