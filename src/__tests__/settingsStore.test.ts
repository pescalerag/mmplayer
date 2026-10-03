import { useSettingsStore, DEFAULT_NOTIFICATION_PREFERENCES } from '../store/useSettingsStore';
import * as Localization from 'expo-localization';
import i18n from 'i18next';

jest.mock('expo-localization', () => ({
  getLocales: jest.fn(() => [{ languageCode: 'es' }]),
}));

describe('useSettingsStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Actions', () => {
    it('updates notification preferences', () => {
      const { setNotificationPreferences } = useSettingsStore.getState();
      const newPrefs = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        enabled: false,
        summaryWeekly: false,
      };
      setNotificationPreferences(newPrefs);
      expect(useSettingsStore.getState().notificationPreferences).toEqual(newPrefs);
    });

    it('updates showHomeGreeting', () => {
      const { setShowHomeGreeting } = useSettingsStore.getState();
      setShowHomeGreeting(false);
      expect(useSettingsStore.getState().showHomeGreeting).toBe(false);
      setShowHomeGreeting(true);
      expect(useSettingsStore.getState().showHomeGreeting).toBe(true);
    });

    it('updates hasAskedNotificationPermission', () => {
      const { setHasAskedNotificationPermission } = useSettingsStore.getState();
      setHasAskedNotificationPermission(true);
      expect(useSettingsStore.getState().hasAskedNotificationPermission).toBe(true);
    });

    it('updates showGlobalShuffle and homeSectionsVisibility', () => {
      const { setShowGlobalShuffle } = useSettingsStore.getState();
      setShowGlobalShuffle(false);
      expect(useSettingsStore.getState().showGlobalShuffle).toBe(false);
      expect(useSettingsStore.getState().homeSectionsVisibility.shuffle_button).toBe(false);

      setShowGlobalShuffle(true);
      expect(useSettingsStore.getState().showGlobalShuffle).toBe(true);
      expect(useSettingsStore.getState().homeSectionsVisibility.shuffle_button).toBe(true);
    });

    it('updates language and informs i18n', () => {
      const i18nSpy = jest.spyOn(i18n, 'changeLanguage').mockImplementation((() => Promise.resolve()) as any);
      const { setLanguage } = useSettingsStore.getState();
      setLanguage('en');
      expect(useSettingsStore.getState().language).toBe('en');
      expect(i18nSpy).toHaveBeenCalledWith('en');
    });

    it('updates shuffleOnQueueEnd', async () => {
      const { setShuffleOnQueueEnd } = useSettingsStore.getState();
      setShuffleOnQueueEnd(true);
      expect(useSettingsStore.getState().shuffleOnQueueEnd).toBe(true);
      // Let import promise resolve
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });

  describe('onRehydrateStorage initialization functions', () => {
    const getRehydrateFn = () => {
      const options = (useSettingsStore as any).persist?.getOptions();
      return options?.onRehydrateStorage?.(useSettingsStore.getState());
    };

    const createMockState = (overrides: any = {}) => ({
      language: 'es',
      activeAppTheme: 'none',
      appTabsOrder: ['Inicio', 'Biblioteca'],
      initialAppRoute: 'Inicio',
      homeSectionsVersion: 2,
      homeSectionsOrder: ['stats', 'shuffle_button'],
      homeSectionsVisibility: { stats: true, shuffle_button: true },
      notificationPreferences: {},
      setLanguage: jest.fn(),
      setActiveAppTheme: jest.fn(),
      setAppTabsOrder: jest.fn(),
      setInitialAppRoute: jest.fn(),
      setHomeSectionsOrder: jest.fn(),
      setHomeSectionsVisibility: jest.fn(),
      setHomeSectionsVersion: jest.fn(),
      ...overrides,
    });

    it('handles null state safely', () => {
      const fn = getRehydrateFn();
      expect(() => fn(null)).not.toThrow();
    });

    it('initializes language when null: default Spanish if system starts with es', () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'es-ES' }]);
      const mockState = createMockState({ language: null });
      const fn = getRehydrateFn();
      fn(mockState);
      expect(mockState.setLanguage).toHaveBeenCalledWith('es');
    });

    it('initializes language when null: default English if system is not Spanish', () => {
      (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'fr' }]);
      const mockState = createMockState({ language: null });
      const fn = getRehydrateFn();
      fn(mockState);
      expect(mockState.setLanguage).toHaveBeenCalledWith('en');
    });

    it('calls i18n.changeLanguage when state.language is already set', () => {
      const i18nSpy = jest.spyOn(i18n, 'changeLanguage').mockImplementation((() => Promise.resolve()) as any);
      const mockState = createMockState({ language: 'es' });
      const fn = getRehydrateFn();
      fn(mockState);
      expect(i18nSpy).toHaveBeenCalledWith('es');
    });

    it('resets theme to none if theme is not none', () => {
      const mockState = createMockState({ activeAppTheme: 'amoled' });
      const fn = getRehydrateFn();
      fn(mockState);
      expect(mockState.setActiveAppTheme).toHaveBeenCalledWith('none');
    });

    it('migrates appTabsOrder and initialAppRoute from Configuración to Actividad', () => {
      const mockState = createMockState({
        appTabsOrder: ['Inicio', 'Biblioteca', 'Configuración'],
        initialAppRoute: 'Configuración',
      });
      const fn = getRehydrateFn();
      fn(mockState);
      expect(mockState.setAppTabsOrder).toHaveBeenCalledWith(['Inicio', 'Biblioteca', 'Actividad']);
      expect(mockState.setInitialAppRoute).toHaveBeenCalledWith('Actividad');
    });

    it('migrates homeSections to V2 when homeSectionsVersion !== 2', () => {
      const mockState = createMockState({
        homeSectionsVersion: 1,
        homeSectionsOrder: ['recent_media', 'favorites'],
        homeSectionsVisibility: {},
        showGlobalShuffle: true,
      });
      const fn = getRehydrateFn();
      fn(mockState);
      expect(mockState.setHomeSectionsOrder).toHaveBeenCalledWith([
        'recent_media',
        'stats',
        'favorites',
        'shuffle_button',
      ]);
      expect(mockState.setHomeSectionsVisibility).toHaveBeenCalledWith({
        stats: true,
        shuffle_button: true,
      });
      expect(mockState.setHomeSectionsVersion).toHaveBeenCalledWith(2);
    });

    it('migrates homeSections to V2 when recent_media is not present', () => {
      const mockState = createMockState({
        homeSectionsVersion: 0,
        homeSectionsOrder: ['favorites'],
        homeSectionsVisibility: {},
        showGlobalShuffle: false,
      });
      const fn = getRehydrateFn();
      fn(mockState);
      expect(mockState.setHomeSectionsOrder).toHaveBeenCalledWith([
        'stats',
        'favorites',
        'shuffle_button',
      ]);
      expect(mockState.setHomeSectionsVisibility).toHaveBeenCalledWith({
        stats: true,
        shuffle_button: false,
      });
    });

    it('ensures stats and shuffle_button are in homeSectionsOrder when version is already 2', () => {
      const mockState = createMockState({
        homeSectionsVersion: 2,
        homeSectionsOrder: ['favorites'],
      });
      const fn = getRehydrateFn();
      fn(mockState);
      expect(mockState.setHomeSectionsOrder).toHaveBeenCalledWith([
        'stats',
        'favorites',
        'shuffle_button',
      ]);
    });

    it('initializes notification preferences with defaults', () => {
      const mockState = createMockState({
        notificationPreferences: { enabled: false },
      });
      const fn = getRehydrateFn();
      fn(mockState);
      expect(mockState.notificationPreferences.enabled).toBe(false);
      expect(mockState.notificationPreferences.summary_weekly).toBe(
        DEFAULT_NOTIFICATION_PREFERENCES.summary_weekly
      );
    });
  });
});
