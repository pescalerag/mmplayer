/* eslint-disable no-undef */

// Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs) => objs.android || objs.default },
  NativeModules: {},
  EventEmitter: jest.fn(),
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (s) => s },
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn(),
    set: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(),
  }),
}));

// Mock @react-native-async-storage/async-storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(null),
  removeItem: jest.fn().mockResolvedValue(null),
}));

// Mock react-native-track-player
const mockTrackPlayer = {
  setRate: jest.fn().mockResolvedValue(undefined),
  setPitch: jest.fn().mockResolvedValue(undefined),
  getRate: jest.fn().mockResolvedValue(1.0),
  getPitch: jest.fn().mockResolvedValue(1.0),
  getQueue: jest.fn().mockResolvedValue([]),
  getActiveTrack: jest.fn().mockResolvedValue(null),
  getActiveTrackIndex: jest.fn().mockResolvedValue(0),
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  reset: jest.fn().mockResolvedValue(undefined),
  play: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
};

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: mockTrackPlayer,
  Event: {},
  State: {},
  RepeatMode: { Off: 0, Track: 1, Queue: 2 },
}));

// Mock expo-modules-core
const mockNativeEqualizerModule = {
  initialize: jest.fn().mockResolvedValue(undefined),
  setEnabled: jest.fn().mockResolvedValue(undefined),
  setBandLevel: jest.fn().mockResolvedValue(undefined),
  setBassBoost: jest.fn().mockResolvedValue(undefined),
  getBandFrequencies: jest.fn().mockResolvedValue([60, 230, 910, 3600, 14000]),
  getBandLevelRange: jest.fn().mockResolvedValue({ min: -1500, max: 1500 }),
  getNumberOfBands: jest.fn().mockResolvedValue(5),
  release: jest.fn().mockResolvedValue(undefined),
  extractColorFromImage: jest.fn().mockResolvedValue('#ff0000'),
};

jest.mock('expo-modules-core', () => ({
  requireNativeModule: jest.fn(() => mockNativeEqualizerModule),
  requireNativeViewManager: jest.fn(() => 'NativeVisualizerView'),
}));

// Mock database
jest.mock('./src/database', () => ({
  database: {
    get: jest.fn(() => ({
      find: jest.fn(),
      query: jest.fn(() => ({ fetch: jest.fn().mockResolvedValue([]) })),
    })),
    write: jest.fn((cb) => cb()),
  },
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es' }],
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  documentDirectory: 'file:///data/user/0/com.mmplayer/files/',
  cacheDirectory: 'file:///data/user/0/com.mmplayer/cache/',
}));
jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/com.mmplayer/files/',
  cacheDirectory: 'file:///data/user/0/com.mmplayer/cache/',
}));

// Mock react-native-http-bridge-refurbished
jest.mock('react-native-http-bridge-refurbished', () => ({
  BridgeServer: jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    post: jest.fn(),
    listen: jest.fn(),
    stop: jest.fn(),
  })),
}));

// Mock LocalCastService and related stores
jest.mock('./src/services/LocalCastService', () => ({
  LocalCastService: {
    startServer: jest.fn().mockResolvedValue(undefined),
    stopServer: jest.fn().mockResolvedValue(undefined),
    isServerRunning: jest.fn().mockReturnValue(false),
  },
}));
jest.mock('./src/store/useCastStore', () => ({
  useCastStore: {
    getState: () => ({ isCasting: false, castDevice: null }),
  },
}));
jest.mock('./src/navigation/navigationRef', () => ({
  navigationRef: { isReady: () => false, navigate: jest.fn() },
}));
jest.mock('./src/store/useToastStore', () => ({
  useToastStore: {
    getState: () => ({ showToast: jest.fn() }),
  },
}));
jest.mock('./modules/native-audio-scanner', () => ({
  readFileChunk: jest.fn().mockResolvedValue(''),
}));

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));
