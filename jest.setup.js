/* eslint-disable no-undef */

// Mock react-native
jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (objs) => objs.android || objs.default },
  NativeModules: {},
  EventEmitter: jest.fn(),
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: (s) => s },
  Linking: {
    openURL: jest.fn().mockResolvedValue(true),
  },
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
  add: jest.fn().mockResolvedValue(undefined),
  remove: jest.fn().mockResolvedValue(undefined),
  removeUpcomingTracks: jest.fn().mockResolvedValue(undefined),
  skip: jest.fn().mockResolvedValue(undefined),
  skipToNext: jest.fn().mockResolvedValue(undefined),
  skipToPrevious: jest.fn().mockResolvedValue(undefined),
  getRepeatMode: jest.fn().mockResolvedValue(0),
  setRepeatMode: jest.fn().mockResolvedValue(undefined),
  getProgress: jest.fn().mockResolvedValue({ position: 0, duration: 180, buffered: 180 }),
  seekTo: jest.fn().mockResolvedValue(undefined),
  updateMetadataForTrack: jest.fn().mockResolvedValue(undefined),
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
const mockTable = {
  find: jest.fn().mockResolvedValue(null),
  query: jest.fn(() => ({
    fetch: jest.fn().mockResolvedValue([]),
    observe: jest.fn(() => ({ subscribe: jest.fn() })),
  })),
};

jest.mock('./src/database', () => ({
  database: {
    get: jest.fn(() => mockTable),
    collections: {
      get: jest.fn(() => mockTable),
    },
    write: jest.fn((cb) => cb()),
    batch: jest.fn((updates) => Promise.resolve(updates)),
  },
}));

// Mock expo-localization
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'es' }],
}));

// Mock expo-haptics
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  notificationAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
// Mock expo-file-system
const mockFileSystem = {
  documentDirectory: 'file:///data/user/0/com.mmplayer/files/',
  cacheDirectory: 'file:///data/user/0/com.mmplayer/cache/',
  getInfoAsync: jest.fn().mockResolvedValue({ exists: true, size: 1024, md5: 'mock-md5' }),
  makeDirectoryAsync: jest.fn().mockResolvedValue(undefined),
  copyAsync: jest.fn().mockResolvedValue(undefined),
  deleteAsync: jest.fn().mockResolvedValue(undefined),
  readDirectoryAsync: jest.fn().mockResolvedValue([]),
};
jest.mock('expo-file-system', () => mockFileSystem);
jest.mock('expo-file-system/legacy', () => mockFileSystem);

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      version: '2.3.2',
    },
  },
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
const mockCastStoreState = { isCasting: false, castDevice: null, isServerRunning: false };
jest.mock('./src/store/useCastStore', () => ({
  useCastStore: {
    getState: () => mockCastStoreState,
    setState: jest.fn((newState) => Object.assign(mockCastStoreState, newState)),
  },
}));
jest.mock('./src/navigation/navigationRef', () => {
  const navigationRef = { isReady: () => false, navigate: jest.fn() };
  return {
    navigationRef,
    waitForNavigationReady: jest.fn(async () => navigationRef.isReady()),
    getActiveTabName: jest.fn(() => 'Biblioteca'),
  };
});
const mockToastState = { showToast: jest.fn() };
jest.mock('./src/store/useToastStore', () => ({
  useToastStore: {
    getState: () => mockToastState,
    setState: jest.fn((newState) => Object.assign(mockToastState, newState)),
  },
}));
jest.mock('./modules/native-audio-scanner', () => ({
  readFileChunk: jest.fn().mockResolvedValue(''),
  generateVideoThumbnail: jest.fn().mockResolvedValue('file:///thumbnail.jpg'),
}));

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k) => k }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

// Mock @notifee/react-native
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn().mockResolvedValue({ authorizationStatus: 1 }),
    createChannel: jest.fn().mockResolvedValue('mmplayer_summaries'),
    createTriggerNotification: jest.fn().mockResolvedValue('notif-id'),
    displayNotification: jest.fn().mockResolvedValue('notif-id'),
    getTriggerNotificationIds: jest.fn().mockResolvedValue([]),
    cancelNotification: jest.fn().mockResolvedValue(undefined),
    getInitialNotification: jest.fn().mockResolvedValue(null),
    onForegroundEvent: jest.fn(() => jest.fn()),
    onBackgroundEvent: jest.fn(),
  },
  AndroidImportance: { DEFAULT: 3, HIGH: 4 },
  TriggerType: { TIMESTAMP: 0, INTERVAL: 1 },
  RepeatFrequency: { DAILY: 0, WEEKLY: 1 },
  AuthorizationStatus: { AUTHORIZED: 1, DENIED: 0 },
  EventType: { PRESS: 1, DELIVERED: 0 },
}));

// Mock react-native-worklets
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn, ...args) => fn(...args),
}));
