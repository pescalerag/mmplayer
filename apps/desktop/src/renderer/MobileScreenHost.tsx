import {
  HeaderHistoryContext,
  type HeaderHistory,
} from "../../../../src/components/layouts/HeaderHistoryControls";
import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { ScreenWidthProvider } from "../../../../src/hooks/useScreenWidth";
import {
  NavigationContext,
  NavigationRouteContext,
} from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import HomeScreen from "../../../../src/screens/home/HomeScreen";
import LibraryScreen from "../../../../src/screens/library/LibraryScreen";
import SearchScreen from "../../../../src/screens/search/SearchScreen";
import AlbumDetailScreen from "../../../../src/screens/library/AlbumDetailScreen";
import ArtistDetailScreen from "../../../../src/screens/library/ArtistDetailScreen";
import PlaylistDetailScreen from "../../../../src/screens/library/PlaylistDetailScreen";
import FavoritesDetailScreen from "../../../../src/screens/library/FavoritesDetailScreen";
import SmartListDetailScreen from "../../../../src/screens/library/SmartListDetailScreen";
import TagManagementScreen from "../../../../src/screens/tags/TagManagementScreen";
import TagDetailScreen from "../../../../src/screens/tags/TagDetailScreen";
import PlayerScreen from "../../../../src/screens/player/PlayerScreen";
import LyricsScreen from "../../../../src/screens/player/LyricsScreen";
import LyricsEditorScreen from "../../../../src/screens/player/LyricsEditorScreen";
import LyricsSyncScreen from "../../../../src/screens/player/LyricsSyncScreen";
import TimestampsEditorScreen from "../../../../src/screens/player/TimestampsEditorScreen";
import ActivityMainScreen from "../../../../src/screens/activity/ActivityMainScreen";
import ActivityHistoryScreen from "../../../../src/screens/activity/ActivityHistoryScreen";
import UserProfileScreen from "../../../../src/screens/profile/UserProfileScreen";
import FolderDetailScreen from "../../../../src/screens/library/FolderDetailScreen";
import NotificationsScreen from "../../../../src/screens/notifications/NotificationsScreen";
import SettingsLanguageScreen from "../../../../src/screens/settings/SettingsLanguageScreen";
import SettingsAppearanceScreen from "../../../../src/screens/settings/SettingsAppearanceScreen";
import SettingsAudioScreen from "../../../../src/screens/settings/SettingsAudioScreen";
import SettingsShuffleScreen from "../../../../src/screens/settings/SettingsShuffleScreen";
import SettingsGesturesScreen from "../../../../src/screens/settings/SettingsGesturesScreen";
import SettingsOtherScreen from "../../../../src/screens/settings/SettingsOtherScreen";
import SettingsExclusionsScreen from "../../../../src/screens/settings/SettingsExclusionsScreen";
import ExcludedMediaScreen from "../../../../src/screens/settings/ExcludedMediaScreen";
import SettingsDebugScreen from "../../../../src/screens/settings/SettingsDebugScreen";
import {
  DebugErrorsScreen,
} from "../../../../src/screens/settings/RuntimeDiagnosticsScreens";
import DebugTestsScreen from "../../../../src/screens/settings/DebugTestsScreen";
import DebugHistoryScreen from "../../../../src/screens/settings/DebugHistoryScreen";
import SettingsArtistImagesScreen from "../../../../src/screens/settings/SettingsArtistImagesScreen";
import SettingsAlbumCoversScreen from "../../../../src/screens/settings/SettingsAlbumCoversScreen";
import SettingsStorageScreen from "../../../../src/screens/settings/SettingsStorageScreen";
import SettingsCanvasScreen from "../../../../src/screens/settings/SettingsCanvasScreen";
import ShareStatsScreen from "../../../../src/screens/activity/ActivityShareScreen";
import ShareSongScreen from "../../../../src/screens/player/SongShareScreen";
import ShareLyricsScreen from "../../../../src/screens/player/LyricsShareScreen";
import DesktopSettingsScreen from "./ports/settingsScreen";
import MultiSelectActionBar from "../../../../src/components/common/MultiSelectActionBar";
import GlobalToast from "../../../../src/components/common/GlobalToast";
import { setDesktopNavigation } from "./ports/navigationRef";

const screens: Record<string, React.ComponentType<any>> = {
  Home: HomeScreen,
  Library: LibraryScreen,
  Search: SearchScreen,
  AlbumDetail: AlbumDetailScreen,
  ArtistDetail: ArtistDetailScreen,
  PlaylistDetail: PlaylistDetailScreen,
  FavoritesDetail: FavoritesDetailScreen,
  SmartListDetail: SmartListDetailScreen,
  Tags: TagManagementScreen,
  TagDetail: TagDetailScreen,
  Player: PlayerScreen,
  Lyrics: LyricsScreen,
  LyricsEditor: LyricsEditorScreen,
  LyricsSync: LyricsSyncScreen,
  TimestampsEditor: TimestampsEditorScreen,
  WeeklyActivity: ActivityMainScreen,
  Activity: ActivityMainScreen,
  ActivityHistory: ActivityHistoryScreen,
  UserProfile: UserProfileScreen,
  FolderDetail: FolderDetailScreen,
  Notifications: NotificationsScreen,
  Settings: DesktopSettingsScreen,
  SettingsLanguage: SettingsLanguageScreen,
  SettingsAppearance: SettingsAppearanceScreen,
  SettingsAudio: SettingsAudioScreen,
  SettingsShuffle: SettingsShuffleScreen,
  SettingsGestures: SettingsGesturesScreen,
  SettingsOther: SettingsOtherScreen,
  SettingsExclusions: SettingsExclusionsScreen,
  ExcludedMedia: ExcludedMediaScreen,
  SettingsDebug: SettingsDebugScreen,
  DebugErrors: DebugErrorsScreen,
  ...(__DEV__ ? { DebugTests: DebugTestsScreen } : {}),
  DebugHistory: DebugHistoryScreen,
  SettingsArtistImages: SettingsArtistImagesScreen,
  SettingsAlbumCovers: SettingsAlbumCoversScreen,
  SettingsStorage: SettingsStorageScreen,
  SettingsCanvas: SettingsCanvasScreen,
  ShareStats: ShareStatsScreen,
  ShareSong: ShareSongScreen,
  ShareLyrics: ShareLyricsScreen,
};
export const hasSharedScreen = (name: string) => Object.hasOwn(screens, name);
export function MobileScreenHost({
  name,
  params,
  navigate,
  back,
  history,
  hidePlayerLyrics = false,
}: {
  name: string;
  params?: Record<string, unknown>;
  navigate: (name: string, params?: any) => void;
  back: () => void;
  history?: HeaderHistory;
  hidePlayerLyrics?: boolean;
}) {
  const [size, setSize] = useState<
    { width: number; height: number } | undefined
  >();
  const route = useMemo(
    () => ({
      name,
      key: `${name}:${JSON.stringify(params || {})}`,
      params: params || {},
    }),
    [name, params],
  );
  const navigation = useMemo(() => {
    const listeners = new Map<string, Set<() => void>>();
    return {
      navigate,
      push: navigate,
      goBack: back,
      pop: back,
      canGoBack: () => true,
      isFocused: () => true,
      getParent: () => undefined,
      getState: () => ({
        type: "stack",
        key: "desktop-center",
        index: 0,
        routeNames: Object.keys(screens),
        routes: [route],
      }),
      addListener: (event: string, fn: () => void) => {
        let set = listeners.get(event);
        if (!set) listeners.set(event, (set = new Set()));
        set.add(fn);
        return () => set!.delete(fn);
      },
      setOptions: () => {},
      setParams: () => {},
      dispatch: (action: any) => {
        if (action.type === "GO_BACK") back();
        else if (action.payload?.name)
          navigate(action.payload.name, action.payload.params);
      },
    };
  }, [navigate, back, route]);
  setDesktopNavigation(navigation);
  const Screen = screens[name];
  if (!Screen) throw Error("Desktop screen is not registered: " + name);
  return (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 800, height: 800 },
        insets: { top: 0, right: 0, bottom: 0, left: 0 },
      }}
    >
      <NavigationContext.Provider value={navigation as never}>
        <NavigationRouteContext.Provider value={route}>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <View
              testID={`mobile-screen-${name}`}
              style={{ flex: 1 }}
              onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setSize({ width, height });
              }}
            >
              <HeaderHistoryContext.Provider value={history ?? null}>
                <ScreenWidthProvider value={size}>
                  <Screen route={route} navigation={navigation} showTierBadge={false} embedded={name === "Player"} hideLyrics={hidePlayerLyrics} />
                  {name !== "Player" && (
                    <>
                      <MultiSelectActionBar />
                      <GlobalToast />
                    </>
                  )}
                </ScreenWidthProvider>
              </HeaderHistoryContext.Provider>
            </View>
          </GestureHandlerRootView>
        </NavigationRouteContext.Provider>
      </NavigationContext.Provider>
    </SafeAreaProvider>
  );
}
