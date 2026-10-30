const {
  withAppBuildGradle,
  withGradleProperties,
  withProjectBuildGradle,
} = require('@expo/config-plugins');

const ANDROID_GRADLE_PLUGIN_VERSION = '8.13.2';

// Expo 54's Android template uses the legacy file, which adds -dontoptimize.
// Apply this after prebuild as well so release optimization survives regeneration.
module.exports = function withAndroidOptimization(config) {
  config = withProjectBuildGradle(config, mod => {
    mod.modResults.contents = mod.modResults.contents.replace(
      /classpath\(['"]com\.android\.tools\.build:gradle(?::[^'"]+)?['"]\)/,
      `classpath('com.android.tools.build:gradle:${ANDROID_GRADLE_PLUGIN_VERSION}')`,
    );
    return mod;
  });
  config = withGradleProperties(config, mod => {
    const properties = {
      'android.enableMinifyInReleaseBuilds': 'true',
      'android.enableShrinkResourcesInReleaseBuilds': 'true',
      'android.enableR8.fullMode': 'true',
      // AGP 8.12/8.13 requires an explicit opt-in; AGP 9 enables it by default.
      'android.r8.optimizedResourceShrinking': 'true',
    };
    for (const [key, value] of Object.entries(properties)) {
      mod.modResults = mod.modResults.filter(property => property.key !== key);
      mod.modResults.push({ type: 'property', key, value });
    }
    return mod;
  });
  return withAppBuildGradle(config, mod => {
    mod.modResults.contents = mod.modResults.contents.replaceAll(
      'proguard-android.txt',
      'proguard-android-optimize.txt',
    );
    return mod;
  });
};
