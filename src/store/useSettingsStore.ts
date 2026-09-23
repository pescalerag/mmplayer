import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import i18n from '../constants/i18n';

export type UserTier = 'USER' | 'SUPPORTER' | 'VIP';
export type StatsCardTheme = 'default' | 'glass' | 'holographic' | 'gold' | 'emerald' | 'sunset' | 'midnight' | 'crimson';
export type LocalCastTheme = 'default' | 'cyberpunk' | 'gold' | 'aurora' | 'emerald' | 'sunset' | 'midnight' | 'crimson';
export type AppTheme = 'none' | 'legendary';

interface SettingsState {
    userTier: UserTier;
    setUserTier: (tier: UserTier) => void;
    appIcon: string;
    setAppIcon: (iconName: string) => void;
    statsCardTheme: StatsCardTheme;
    setStatsCardTheme: (theme: StatsCardTheme) => void;
    localCastTheme: LocalCastTheme;
    setLocalCastTheme: (theme: LocalCastTheme) => void;
    customAccentColor: string | null;
    setCustomAccentColor: (color: string | null) => void;
    activeAppTheme: AppTheme;
    setActiveAppTheme: (theme: AppTheme) => void;
    hasOrphanedUpgrade: boolean;
    setHasOrphanedUpgrade: (val: boolean) => void;
    showTagColors: boolean;
    setShowTagColors: (value: boolean) => void;
    excludedFolders: string[];
    excludeFolder: (folderPath: string) => void;
    includeFolder: (folderPath: string) => void;
    excludedSongs: string[];
    excludeSong: (songPath: string) => void;
    includeSong: (songPath: string) => void;
    lastSeenVersion: string | null;
    setLastSeenVersion: (version: string) => void;
    userAlias: string | null;
    setUserAlias: (alias: string) => void;
    userAvatarUri: string | null;
    setUserAvatarUri: (uri: string | null) => void;
    forceWelcomeModal: boolean;
    setForceWelcomeModal: (value: boolean) => void;
    hasSeenWelcomeModal: boolean;
    setHasSeenWelcomeModal: (value: boolean) => void;
    hasSeenLibraryTutorial: boolean;
    setHasSeenLibraryTutorial: (value: boolean) => void;
    hasSeenTagsTutorial: boolean;
    setHasSeenTagsTutorial: (value: boolean) => void;
    hasSeenPlayerTutorial: boolean;
    setHasSeenPlayerTutorial: (value: boolean) => void;
    hasSeenSearchTutorial: boolean;
    setHasSeenSearchTutorial: (value: boolean) => void;
    hasSeenActivityTutorial: boolean;
    setHasSeenActivityTutorial: (value: boolean) => void;
    language: string | null;
    setLanguage: (lang: string) => void;
    hideSyncToastOnResume: boolean;
    setHideSyncToastOnResume: (value: boolean) => void;
    swipeLeftAction: SwipeAction;
    setSwipeLeftAction: (action: SwipeAction) => void;
    swipeRightAction: SwipeAction;
    setSwipeRightAction: (action: SwipeAction) => void;
    isNormalizationEnabled: boolean;
    queueAddBehavior: QueueAddBehavior;
    setQueueAddBehavior: (behavior: QueueAddBehavior) => void;
    preampLevel: number; // Ej: de 0 a +6 dB
    fallbackGainDB: number; // Ej: 0, -3, -5 o -10 dB
    setNormalizationEnabled: (enabled: boolean) => void;
    setPreampLevel: (level: number) => void;
    setFallbackGain: (level: number) => void;
    libraryTabsOrder: LibraryTabType[];
    setLibraryTabsOrder: (order: LibraryTabType[]) => void;
    appTabsOrder: AppTabType[];
    setAppTabsOrder: (order: AppTabType[]) => void;
    initialAppRoute: AppTabType;
    setInitialAppRoute: (route: AppTabType) => void;
    homeSectionsOrder: HomeSection[];
    setHomeSectionsOrder: (order: HomeSection[]) => void;
    homeSectionsVisibility: Record<HomeSection, boolean>;
    setHomeSectionsVisibility: (visibility: Record<HomeSection, boolean>) => void;
    showGlobalShuffle: boolean;
    setShowGlobalShuffle: (value: boolean) => void;
    isCompactTags: boolean;
    setIsCompactTags: (value: boolean) => void;
    artistImageDownloadMode: 'disabled' | 'main' | 'all';
    setArtistImageDownloadMode: (value: 'disabled' | 'main' | 'all') => void;
    artistImageBackgroundDownload: boolean;
    setArtistImageBackgroundDownload: (value: boolean) => void;
    isFadeEnabled: boolean;
    setIsFadeEnabled: (value: boolean) => void;
    isKeepAwakeEnabled: boolean;
    setIsKeepAwakeEnabled: (value: boolean) => void;
    isEqualizerEnabled: boolean;
    setIsEqualizerEnabled: (value: boolean) => void;
    equalizerBands: number[];
    setEqualizerBand: (index: number, levelMb: number) => void;
    setEqualizerBands: (bands: number[]) => void;
    bassBoostStrength: number;
    setBassBoostStrength: (value: number) => void;
    showPlayerVisualizer: boolean;
    setShowPlayerVisualizer: (value: boolean) => void;
    playerVisualizerType: 'bars' | 'wave' | 'spectrum' | 'circle';
    setPlayerVisualizerType: (value: 'bars' | 'wave' | 'spectrum' | 'circle') => void;
    playerVisualizerColorMode: 'accent' | 'cover';
    setPlayerVisualizerColorMode: (value: 'accent' | 'cover') => void;
    playerCoverStyle: 'cover' | 'cd' | 'vinyl';
    setPlayerCoverStyle: (value: 'cover' | 'cd' | 'vinyl') => void;
    playerBackgroundStyle: 'cover' | 'gradient';
    setPlayerBackgroundStyle: (value: 'cover' | 'gradient') => void;
    showCanvas: boolean;
    setShowCanvas: (value: boolean) => void;
    showPlayerLyrics: boolean;
    setShowPlayerLyrics: (value: boolean) => void;
    homeProfilePosition: 'left' | 'right';
    setHomeProfilePosition: (position: 'left' | 'right') => void;
    shuffleOnQueueEnd: boolean;
    setShuffleOnQueueEnd: (value: boolean) => void;
    homeSectionsVersion: number;
    setHomeSectionsVersion: (version: number) => void;
}

export type QueueAddBehavior = 'user_queue' | 'context_queue';
export type SwipeAction = 'add_next' | 'add_last' | 'toggle_favorite' | 'add_to_playlist' | 'none';
export type LibraryTabType = 'albums' | 'artists' | 'tracks' | 'playlists' | 'folders';
export type AppTabType = 'Inicio' | 'Biblioteca' | 'Buscar' | 'Etiquetas' | 'Actividad';
export type HomeSection = 'recent_media' | 'stats' | 'smart_playlists' | 'recent_playlists' | 'recently_added' | 'most_played' | 'explore' | 'shuffle_button';

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            showTagColors: true,
            setShowTagColors: (value) => set({ showTagColors: value }),
            isNormalizationEnabled: true,
            queueAddBehavior: 'user_queue',
            setQueueAddBehavior: (behavior) => set({ queueAddBehavior: behavior }),
            preampLevel: 0,
            fallbackGainDB: -5,
            setNormalizationEnabled: (enabled) => set({ isNormalizationEnabled: enabled }),
            setPreampLevel: (level) => set({ preampLevel: level }),
            setFallbackGain: (level) => set({ fallbackGainDB: level }),
            hideSyncToastOnResume: true,
            setHideSyncToastOnResume: (value) => set({ hideSyncToastOnResume: value }),
            swipeLeftAction: 'add_last',
            setSwipeLeftAction: (action) => set({ swipeLeftAction: action }),
            swipeRightAction: 'add_next',
            setSwipeRightAction: (action) => set({ swipeRightAction: action }),
            libraryTabsOrder: ['albums', 'playlists', 'artists', 'folders', 'tracks'],
            setLibraryTabsOrder: (order) => set({ libraryTabsOrder: order }),
            appTabsOrder: ['Inicio', 'Biblioteca', 'Buscar', 'Etiquetas', 'Actividad'],
            setAppTabsOrder: (order) => set({ appTabsOrder: order }),
            initialAppRoute: 'Inicio',
            setInitialAppRoute: (route) => set({ initialAppRoute: route }),
            homeSectionsOrder: ['recent_media', 'stats', 'smart_playlists', 'recent_playlists', 'recently_added', 'most_played', 'explore', 'shuffle_button'],
            setHomeSectionsOrder: (order) => set({ homeSectionsOrder: order }),
            homeSectionsVersion: 2,
            setHomeSectionsVersion: (version) => set({ homeSectionsVersion: version }),
            homeSectionsVisibility: {
                recent_media: true,
                stats: true,
                smart_playlists: true,
                recent_playlists: true,
                recently_added: true,
                most_played: true,
                explore: true,
                shuffle_button: true,
            },
            setHomeSectionsVisibility: (visibility) => set({ homeSectionsVisibility: visibility }),
            showGlobalShuffle: true,
            setShowGlobalShuffle: (value) => set((state) => ({
                showGlobalShuffle: value,
                homeSectionsVisibility: {
                    ...state.homeSectionsVisibility,
                    shuffle_button: value,
                },
            })),
            isCompactTags: true,
            setIsCompactTags: (value) => set({ isCompactTags: value }),
            artistImageDownloadMode: 'disabled',
            setArtistImageDownloadMode: (value) => set({ artistImageDownloadMode: value }),
            artistImageBackgroundDownload: false,
            setArtistImageBackgroundDownload: (value) => set({ artistImageBackgroundDownload: value }),
            isFadeEnabled: true,
            setIsFadeEnabled: (value) => set({ isFadeEnabled: value }),
            isKeepAwakeEnabled: false,
            setIsKeepAwakeEnabled: (value) => set({ isKeepAwakeEnabled: value }),
            isEqualizerEnabled: false,
            setIsEqualizerEnabled: (value) => set({ isEqualizerEnabled: value }),
            equalizerBands: [0, 0, 0, 0, 0, 0, 0, 0, 0],
            setEqualizerBand: (index, levelMb) => set((state) => {
                const bands = [...state.equalizerBands];
                bands[index] = levelMb;
                return { equalizerBands: bands };
            }),
            setEqualizerBands: (bands) => set({ equalizerBands: bands }),
            bassBoostStrength: 0,
            setBassBoostStrength: (value) => set({ bassBoostStrength: value }),
            showPlayerVisualizer: false,
            setShowPlayerVisualizer: (value) => set({ showPlayerVisualizer: value }),
            playerVisualizerType: 'bars',
            setPlayerVisualizerType: (value) => set({ playerVisualizerType: value }),
            playerVisualizerColorMode: 'cover',
            setPlayerVisualizerColorMode: (value) => set({ playerVisualizerColorMode: value }),
            playerCoverStyle: 'cover',
            setPlayerCoverStyle: (value) => set({ playerCoverStyle: value }),
            playerBackgroundStyle: 'cover',
            setPlayerBackgroundStyle: (value) => set({ playerBackgroundStyle: value }),
            showCanvas: true,
            setShowCanvas: (value) => set({ showCanvas: value }),
            showPlayerLyrics: true,
            setShowPlayerLyrics: (value) => set({ showPlayerLyrics: value }),
            userTier: 'USER',
            setUserTier: (tier) => set({ userTier: tier }),
            appIcon: 'DEFAULT',
            setAppIcon: (iconName) => set({ appIcon: iconName }),
            statsCardTheme: 'default',
            setStatsCardTheme: (theme) => set({ statsCardTheme: theme }),
            localCastTheme: 'default',
            setLocalCastTheme: (theme) => set({ localCastTheme: theme }),
            customAccentColor: null,
            setCustomAccentColor: (color) => set({ customAccentColor: color }),
            activeAppTheme: 'none',
            setActiveAppTheme: (_theme) => set({ activeAppTheme: 'none' }),
            hasOrphanedUpgrade: false,
            setHasOrphanedUpgrade: (val) => set({ hasOrphanedUpgrade: val }),
            excludedFolders: [],
            excludedSongs: [],
            excludeFolder: (folderPath) => set((state) => {
                if (state.excludedFolders.includes(folderPath)) return state;
                return { excludedFolders: [...state.excludedFolders, folderPath] };
            }),
            includeFolder: (folderPath) => set((state) => ({
                excludedFolders: state.excludedFolders.filter((f) => f !== folderPath),
            })),
            excludeSong: (songPath) => set((state) => {
                const songs = state.excludedSongs || [];
                if (songs.includes(songPath)) return state;
                return { excludedSongs: [...songs, songPath] };
            }),
            includeSong: (songPath) => set((state) => ({
                excludedSongs: (state.excludedSongs || []).filter((s) => s !== songPath),
            })),
            lastSeenVersion: null,
            setLastSeenVersion: (version) => set({ lastSeenVersion: version }),
            userAlias: null,
            setUserAlias: (alias) => set({ userAlias: alias }),
            userAvatarUri: null,
            setUserAvatarUri: (uri) => set({ userAvatarUri: uri }),
            forceWelcomeModal: false,
            setForceWelcomeModal: (value) => set({ forceWelcomeModal: value }),
            hasSeenWelcomeModal: false,
            setHasSeenWelcomeModal: (value) => set({ hasSeenWelcomeModal: value }),
            hasSeenLibraryTutorial: false,
            setHasSeenLibraryTutorial: (value) => set({ hasSeenLibraryTutorial: value }),
            hasSeenTagsTutorial: false,
            setHasSeenTagsTutorial: (value) => set({ hasSeenTagsTutorial: value }),
            hasSeenPlayerTutorial: false,
            setHasSeenPlayerTutorial: (value) => set({ hasSeenPlayerTutorial: value }),
            hasSeenSearchTutorial: false,
            setHasSeenSearchTutorial: (value) => set({ hasSeenSearchTutorial: value }),
            hasSeenActivityTutorial: false,
            setHasSeenActivityTutorial: (value) => set({ hasSeenActivityTutorial: value }),
            language: null,
            setLanguage: (lang) => {
                set({ language: lang });
                i18n.changeLanguage(lang);
            },
            homeProfilePosition: 'left',
            setHomeProfilePosition: (position) => set({ homeProfilePosition: position }),
            shuffleOnQueueEnd: false,
            setShuffleOnQueueEnd: (value) => {
                set({ shuffleOnQueueEnd: value });
                try {
                    const { usePlayerStore } = require('./usePlayerStore');
                    usePlayerStore.getState().updateQueueStatus();
                } catch { }
            },
        }),
        {
            name: 'mmplayer-settings',
            storage: createJSONStorage(() => AsyncStorage),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    if (!state.language) {
                        const locales = Localization.getLocales();
                        const systemLanguage = locales[0]?.languageCode ?? 'es';
                        const defaultLang = systemLanguage.startsWith('es') ? 'es' : 'en';
                        state.setLanguage(defaultLang);
                    } else {
                        i18n.changeLanguage(state.language);
                    }
                    if (state.activeAppTheme && state.activeAppTheme !== 'none') {
                        state.setActiveAppTheme('none');
                    }
                    if (state.appTabsOrder) {
                        if ((state.appTabsOrder as any[]).includes('Configuración')) {
                            state.setAppTabsOrder(state.appTabsOrder.map(tab => (tab as any) === 'Configuración' ? 'Actividad' : tab));
                        }
                        if ((state.initialAppRoute as any) === 'Configuración') {
                            state.setInitialAppRoute('Actividad');
                        }
                    }
                    if (state.homeSectionsVersion !== 2) {
                        let newOrder = state.homeSectionsOrder ? [...state.homeSectionsOrder] : [];
                        newOrder = newOrder.filter(s => s !== 'stats' && s !== 'shuffle_button');
                        const recentIdx = newOrder.indexOf('recent_media');
                        if (recentIdx !== -1) {
                            newOrder.splice(recentIdx + 1, 0, 'stats');
                        } else {
                            newOrder.unshift('stats');
                        }
                        newOrder.push('shuffle_button');
                        state.setHomeSectionsOrder(newOrder);

                        const newVis = { ...state.homeSectionsVisibility };
                        newVis.stats = true;
                        newVis.shuffle_button = state.showGlobalShuffle ?? true;
                        state.setHomeSectionsVisibility(newVis);

                        state.setHomeSectionsVersion(2);
                    } else if (state.homeSectionsOrder) {
                        let currentOrder = [...state.homeSectionsOrder];
                        let changed = false;
                        if (!currentOrder.includes('stats')) {
                            const recentIdx = currentOrder.indexOf('recent_media');
                            if (recentIdx !== -1) {
                                currentOrder.splice(recentIdx + 1, 0, 'stats');
                            } else {
                                currentOrder.unshift('stats');
                            }
                            changed = true;
                        }
                        if (!currentOrder.includes('shuffle_button')) {
                            currentOrder.push('shuffle_button');
                            changed = true;
                        }
                        if (changed) {
                            state.setHomeSectionsOrder(currentOrder);
                        }
                    }
                }
            }
        }
    )
);

