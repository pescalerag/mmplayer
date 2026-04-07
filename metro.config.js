const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// 1. Stub out Node.js modules for the web/react-native
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  fs: require.resolve('expo-file-system'), 
  path: require.resolve('path-browserify'),
  stream: require.resolve('stream-browserify'),
  events: require.resolve('events'),
  'react-native-fs': path.resolve(__dirname, 'empty-module.js'),
  'better-sqlite3': path.resolve(__dirname, 'empty-module.js'),
};

// 2. Force jsmediatags to use a file that actually exists
// The 'browser' field in their package.json points to a missing file.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jsmediatags') {
    return {
      filePath: path.resolve(__dirname, 'node_modules/jsmediatags/build2/jsmediatags.js'),
      type: 'sourceFile',
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
