/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react',
          esModuleInterop: true,
          experimentalDecorators: true,
          useDefineForClassFields: false,
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/services/EqualizerService.ts',
    'src/services/ShuffleService.ts',
    'src/services/MediaAssetService.ts',
    'src/services/HistoryService.ts',
    'src/services/NotificationService.ts',
    'src/services/ExternalAudioService.ts',
    'src/services/LyricsService.ts',
    'src/services/RingtoneService.ts',
    'src/services/ScannerService.ts',
    'src/store/usePlayerStore.ts',
    'src/store/useNotificationStore.ts',
    'src/store/useSettingsStore.ts',
    'src/store/useUIStore.ts',
    'src/utils/delayedLoader.ts',
    'src/utils/notificationHelpers.ts',
    'src/utils/cascadeAnimations.ts',
    'src/utils/shuffle.ts',
    'src/hooks/useDelayedLoader.ts',
    'src/database/models/Album.ts',
    'src/database/models/Track.ts',
    'modules/native-equalizer/index.ts',
    'src/screens/activity/utils/activityStatUtils.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text', 'html'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
};
