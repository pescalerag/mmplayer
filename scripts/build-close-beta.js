// Run from the repository root: node scripts/build-close-beta.js
// Uses the local release signing configuration and restores production files afterwards.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { enableBetaVipSettings, enableBetaVipPurchases } = require('./beta-build-config.cjs');

const root = path.resolve(__dirname, '..');
const android = path.join(root, 'android');
const app = path.join(android, 'app');
const packageName = 'com.pescalerag.mmplayerbeta';
const version = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo.version;
const originals = new Map();
const enableVip = process.argv.includes('--vip');

function edit(relativePath, transform) {
  const filename = path.join(app, relativePath);
  const original = fs.readFileSync(filename);
  const updated = transform(original.toString('utf8'));
  if (updated === original.toString('utf8')) {
    throw new Error(`Expected configuration was not found in ${relativePath}`);
  }
  originals.set(filename, original);
  fs.writeFileSync(filename, updated);
}

try {
  if (enableVip) {
    for (const [relativePath, transform] of [
      ['src/store/useSettingsStore.ts', enableBetaVipSettings],
      ['src/services/PurchasesService.ts', enableBetaVipPurchases],
    ]) {
      const filename = path.join(root, relativePath);
      const original = fs.readFileSync(filename);
      const updated = transform(original.toString('utf8'));
      originals.set(filename, original);
      fs.writeFileSync(filename, updated);
    }
  }
  edit('build.gradle', text => text.replace(
    "applicationId 'com.pescalerag.mmplayer'",
    `applicationId '${packageName}'`,
  ));
  edit('src/main/res/values/strings.xml', text => text.replace(
    '<string name="app_name">MMPlayer</string>',
    '<string name="app_name">MMPlayer Beta</string>',
  ));
  edit('src/main/AndroidManifest.xml', text => {
    text = text.replaceAll(
      'android:name="com.pescalerag.mmplayer.MainActivity',
      `android:name="${packageName}.MainActivity`,
    );
    // The icon module expects <installed package>.MainActivity, including DEFAULT.
    // Keep the real activity in its Kotlin namespace and expose a beta launcher alias.
    let launcherFilter;
    text = text.replace(/<activity android:name="\.MainActivity"[\s\S]*?<\/activity>/, activity => {
      const updated = activity.replace(/\s*<intent-filter>[\s\S]*?<\/intent-filter>/g, filter => {
        if (!filter.includes('android.intent.category.LAUNCHER')) return filter;
        if (launcherFilter) throw new Error('Multiple default launcher filters');
        launcherFilter = filter;
        return '';
      });
      if (!launcherFilter) throw new Error('Default launcher filter not found');
      return `${updated}\n    <activity-alias android:name="${packageName}.MainActivity" android:targetActivity=".MainActivity" android:enabled="true" android:exported="true" android:label="@string/app_name" android:icon="@mipmap/ic_launcher" android:roundIcon="@mipmap/ic_launcher_round">${launcherFilter}\n    </activity-alias>`;
    });
    if (!launcherFilter) throw new Error('MainActivity not found');
    return text;
  });

  const command = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  const result = spawnSync(command, [':app:assembleRelease', '-x', 'lint', '-x', 'test',
    '--configure-on-demand', '--build-cache', '--console=plain', '--max-workers=4', '--stacktrace'], {
    cwd: android,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Gradle exited with status ${result.status}`);
  const output = path.join(root, 'dist', `MMPlayer-v${version}-beta${enableVip ? '-vip' : ''}-release.apk`);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.copyFileSync(path.join(app, 'build/outputs/apk/release/app-release.apk'), output);
  console.log(`Beta APK: ${output}\nPackage: ${packageName}`);
} finally {
  for (const [filename, original] of originals) fs.writeFileSync(filename, original);
}
