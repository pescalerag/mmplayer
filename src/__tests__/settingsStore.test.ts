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
    it('defaults crossfade off and persists a bounded whole-second duration', () => {
      expect(useSettingsStore.getState().crossfadeSeconds).toBe(0);
      useSettingsStore.getState().setCrossfadeSeconds(6);
      expect(useSettingsStore.getState().crossfadeSeconds).toBe(6);
      useSettingsStore.getState().setCrossfadeSeconds(50);
      expect(useSettingsStore.getState().crossfadeSeconds).toBe(12);
      useSettingsStore.getState().setCrossfadeSeconds(NaN);
      expect(useSettingsStore.getState().crossfadeSeconds).toBe(0);
    });

    it('defaults the cassette album label off and allows changing its persisted preference', () => {
      expect(useSettingsStore.getState().showCassetteAlbumName).toBe(false);
      useSettingsStore.getState().setShowCassetteAlbumName(true);
      expect(useSettingsStore.getState().showCassetteAlbumName).toBe(true);
      useSettingsStore.getState().setShowCassetteAlbumName(false);
    });

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

  });

  describe('onRehydrateStorage initialization functions', () => {
    it('inserts the ranking after most played while preserving existing section preferences', () => {
      const state = useSettingsStore.getState();
      state.setHomeSectionsOrder(['stats', 'most_played', 'explore', 'shuffle_button']);
      state.setHomeSectionsVisibility({ ...state.homeSectionsVisibility, explore: false });
      const fn = getRehydrateFn();
      fn(useSettingsStore.getState());
      expect(useSettingsStore.getState().homeSectionsOrder).toEqual(['stats', 'most_played', 'top_rated_albums', 'explore', 'shuffle_button']);
      expect(useSettingsStore.getState().homeSectionsVisibility.explore).toBe(false);
      expect(useSettingsStore.getState().homeSectionsVisibility.top_rated_albums).toBe(true);
      const current = useSettingsStore.getState();
      current.setHomeSectionsOrder(['top_rated_albums', 'stats', 'shuffle_button']);
      current.setHomeSectionsVisibility({ ...current.homeSectionsVisibility, top_rated_albums: false });
      fn(useSettingsStore.getState());
      expect(useSettingsStore.getState().homeSectionsOrder).toEqual(['top_rated_albums', 'stats', 'shuffle_button']);
      expect(useSettingsStore.getState().homeSectionsVisibility.top_rated_albums).toBe(false);
    });
    const getRehydrateFn = () => {
      const options = (useSettingsStore as any).persist?.getOptions();
      return options?.onRehydrateStorage?.(useSettingsStore.getState());
    };

    const createMockState = (overrides: any = {}) => ({
      language: 'es',
      portugueseLanguageOffer: 'unseen',
      setPortugueseLanguageOffer: jest.fn(),
      activeAppTheme: 'none',
      appTabsOrder: ['Inicio', 'Biblioteca'],
      initialAppRoute: 'Inicio',
      homeSectionsVersion: 2,
      homeSectionsOrder: ['stats', 'shuffle_button'],
      homeSectionsVisibility: { stats: true, shuffle_button: true },
      notificationPreferences: {},
      setLanguage: jest.fn(),
      appIcon: 'DEFAULT',
      setAppIcon: jest.fn(),
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

    it('migrates a retired icon on hydration without resetting the choice', () => {
      const mockState = createMockState({ appIcon: 'darkblue' });
      getRehydrateFn()(mockState);
      expect(mockState.setAppIcon).toHaveBeenCalledWith('aqua');
    });

    it('does not rewrite the icon setting when the choice is current', () => {
      const mockState = createMockState({ appIcon: 'dark' });
      getRehydrateFn()(mockState);
      expect(mockState.setAppIcon).not.toHaveBeenCalled();
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

    it('resets an unsupported theme to none', () => {
      const mockState = createMockState({ activeAppTheme: 'amoled' });
      const fn = getRehydrateFn();
      fn(mockState);
      expect(mockState.setActiveAppTheme).toHaveBeenCalledWith('none');
    });

    it('preserves the legendary theme between sessions', () => {
      const mockState = createMockState({ activeAppTheme: 'legendary' });
      getRehydrateFn()(mockState);
      expect(mockState.setActiveAppTheme).not.toHaveBeenCalled();
      useSettingsStore.getState().setActiveAppTheme('legendary');
      expect(useSettingsStore.getState().activeAppTheme).toBe('legendary');
      useSettingsStore.getState().setActiveAppTheme('none');
      expect(useSettingsStore.getState().activeAppTheme).toBe('none');
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
        'top_rated_albums',
        'recent_media',
        'stats',
        'favorites',
        'shuffle_button',
      ]);
      expect(mockState.setHomeSectionsVisibility).toHaveBeenCalledWith({
        stats: true,
        shuffle_button: true,
        top_rated_albums: true,
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
        'top_rated_albums',
        'stats',
        'favorites',
        'shuffle_button',
      ]);
      expect(mockState.setHomeSectionsVisibility).toHaveBeenCalledWith({
        stats: true,
        shuffle_button: false,
        top_rated_albums: true,
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
        'top_rated_albums',
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
