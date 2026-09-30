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
    'src/store/usePlayerStore.ts',
    'modules/native-equalizer/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text', 'html'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
};
