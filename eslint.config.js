// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      'src/components/parallax-scroll-view.tsx',
      'src/components/themed-text.tsx',
      'src/components/themed-view.tsx',
      'src/components/ui/collapsible.tsx',
      'src/components/ui/icon-symbol.tsx',
    ],
  },
]);
