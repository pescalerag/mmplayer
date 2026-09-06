import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { AppState, AppStateStatus, Animated, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlobalSyncIndicator from '@/components/common/GlobalSyncIndicator';
import { ScannerService } from "../services/ScannerService";
import { useSettingsStore } from "../store/useSettingsStore";
import { usePlayerStore } from "../store/usePlayerStore";
import { Colors } from "../theme/theme";
import { useAppTheme } from '../hooks/useAppTheme';

import MiniPlayer from '@/components/player/MiniPlayer';
import { useCastStore } from "../store/useCastStore";
import { openLocalCast } from "../store/useUIStore";
import { useTranslation } from "react-i18next";
import DebugHistoryScreen from "../screens/settings/DebugHistoryScreen";
import TagsNavigator from "./TagsNavigator";
import HomeNavigator from "./HomeNavigator";
import LibraryNavigator from "./LibraryNavigator";
import PlayerNavigator from "./PlayerNavigator";
import SearchNavigator from "./SearchNavigator";
import SettingsNavigator from "./SettingsNavigator";
import ActivityShareScreen from "../screens/activity/ActivityShareScreen";
import SongShareScreen from "../screens/player/SongShareScreen";
import LyricsShareScreen from "../screens/player/LyricsShareScreen";
import { RootStackParamList } from "./types";
import MultiSelectActionBar from '@/components/common/MultiSelectActionBar';

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator<RootStackParamList>();

// --- BANNER DE CASTEO ---
const CastingBanner = () => {
  const isLocalCastActive = useCastStore(state => state.isLocalCastActive);
  const isChromecastConnected = useCastStore(state => state.isChromecastConnected);
  const connectedDeviceName = useCastStore(state => state.connectedDeviceName);
  const isCasting = isLocalCastActive || isChromecastConnected;

  const openCastSheet = openLocalCast;
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  const opacity = React.useRef(new Animated.Value(0)).current;
  const translateY = React.useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: isCasting ? 1 : 0,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: isCasting ? 0 : 12,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isCasting]);

  if (!isCasting) return null;

  return (
    <Animated.View style={[castBannerStyles.wrapper, { opacity, transform: [{ translateY }] }]}>
      <TouchableOpacity
        style={[castBannerStyles.banner, { borderColor: colors.accentAlpha40 }]}
        onPress={openCastSheet}
        activeOpacity={0.8}
      >
        {/* Dot de estado activo */}
        <View style={[castBannerStyles.dot, { backgroundColor: colors.accentLight }]} />
        <Ionicons name={isChromecastConnected ? "tv" : "desktop"} size={13} color="#fff" style={{ marginRight: 5 }} />
        <Text style={castBannerStyles.label}>
          {isChromecastConnected
            ? t('cast.chromecast_connected_to', { device: connectedDeviceName || 'Chromecast' })
            : t('cast.banner_label')}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const castBannerStyles = StyleSheet.create({
  wrapper: {
    width: '100%',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 20, 20, 0.92)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.4)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DDD6FE',
    marginRight: 4,
  },
  label: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  tapHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    marginLeft: 6,
  },
});

type TabBarIconProps = {
  routeName: string;
  focused: boolean;
  color: string;
};
const TagsIcon = ({ color, focused }: { color: string; focused: boolean }) => (
  <Ionicons
    name={focused ? "pricetags" : "pricetags-outline"}
    size={32}
    color={color}
  />
);
const TabBarIcon = ({ routeName, focused, color }: TabBarIconProps) => {
  let iconName: React.ComponentProps<typeof Ionicons>["name"];

  if (routeName === "Inicio") {
    iconName = focused ? "home" : "home-outline";
  } else if (routeName === "Biblioteca") {
    iconName = focused ? "library" : "library-outline";
  } else if (routeName === "Configuración") {
    iconName = focused ? "settings" : "settings-outline";
  } else if (routeName === "Buscar") {
    iconName = focused ? "search" : "search-outline";
  } else {
    iconName = "help-outline";
  }

  return <Ionicons name={iconName} size={32} color={color} />;
};

const HomeIcon = ({ color, focused }: { color: string; focused: boolean }) => (
  <TabBarIcon routeName="Inicio" color={color} focused={focused} />
);

const LibraryIcon = ({
  color,
  focused,
}: {
  color: string;
  focused: boolean;
}) => <TabBarIcon routeName="Biblioteca" color={color} focused={focused} />;

const SettingsIcon = ({
  color,
  focused,
}: {
  color: string;
  focused: boolean;
}) => <TabBarIcon routeName="Configuración" color={color} focused={focused} />;

const SearchIcon = ({
  color,
  focused,
}: {
  color: string;
  focused: boolean;
}) => <TabBarIcon routeName="Buscar" color={color} focused={focused} />;

const TabBarBackground = () => (
  <LinearGradient
    colors={[
      "rgba(0, 0, 0, 0)",
      "rgba(0, 0, 0, 0.65)",
      "rgba(0, 0, 0, 0.90)",
      "rgba(0, 0, 0, 0.98)",
      Colors.background,
    ]}
    locations={[0, 0.2, 0.45, 0.75, 1]}
    style={StyleSheet.absoluteFill}
  />
);

const createTabListener = (navigation: any, route: any) => ({
  tabPress: (e: any) => {
    const state = navigation.getState();
    if (state) {
      const currentRoute = state.routes[state.index];
      const isFocused = currentRoute?.name === route.name;

      if (isFocused) {
        const nestedState = currentRoute.state;
        const isAtRoot = !nestedState || nestedState.index === 0;

        if (isAtRoot) {
          e.preventDefault();
          return;
        }
      }
    }

    e.preventDefault();
    navigation.reset({
      index: 0,
      routes: [{ name: route.name, params: undefined }],
    });
  },
});

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { appTabsOrder, initialAppRoute } = useSettingsStore();
  const { colors } = useAppTheme();
  const activeTrack = usePlayerStore(state => state.activeTrack);

  const screenOptions = React.useMemo(
    () => ({
      tabBarShowLabel: false,
      tabBarActiveTintColor: colors.tabIconSelected,
      tabBarInactiveTintColor: colors.tabIconDefault,
      tabBarStyle: {
        borderTopWidth: 0,
        backgroundColor: "transparent",
        elevation: 0,
        position: "absolute" as const,
        height: 60 + insets.bottom,
      },
      tabBarIconStyle: {
        width: 40,
        height: 40,
      },
      tabBarBackground: TabBarBackground,
      headerShown: false,
    }),
    [insets, colors],
  );

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator screenOptions={screenOptions} initialRouteName={initialAppRoute}>
        {appTabsOrder.map(tabName => {
          let Component: any;
          let IconComp: any;
          let useListener = true;

          switch (tabName) {
            case 'Inicio':
              Component = HomeNavigator;
              IconComp = HomeIcon;
              break;
            case 'Biblioteca':
              Component = LibraryNavigator;
              IconComp = LibraryIcon;
              break;
            case 'Buscar':
              Component = SearchNavigator;
              IconComp = SearchIcon;
              break;
            case 'Etiquetas':
              Component = TagsNavigator;
              IconComp = TagsIcon;
              useListener = true; // Ahora TagsNavigator sí usa listener
              break;
            case 'Configuración':
              Component = SettingsNavigator;
              IconComp = SettingsIcon;
              break;
          }

          return (
            <Tab.Screen
              key={tabName}
              name={tabName}
              component={Component}
              options={{ tabBarIcon: IconComp }}
              listeners={useListener ? ({ navigation, route }) => createTabListener(navigation, route) : undefined}
            />
          );
        })}
      </Tab.Navigator>

      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          bottom: 60 + insets.bottom,
          left: 0,
          right: 0,
          zIndex: 100,
        }}
      >
        <View style={{ paddingHorizontal: 12 }} pointerEvents="box-none">
          <CastingBanner />
          <MiniPlayer />
        </View>
        {Boolean(activeTrack) && (
          <Pressable
            android_disableSound={true}
            onStartShouldSetResponder={() => true}
            style={{ height: 12, width: "100%" }}
            onPress={(e) => {
              e?.stopPropagation?.();
            }}
          />
        )}
      </View>

      <MultiSelectActionBar />
    </View>
  );
}

export default function MainNavigator() {
  const appState = React.useRef(AppState.currentState);

  useEffect(() => {
    ScannerService.syncLibrary();

    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        const isSilent = useSettingsStore.getState().hideSyncToastOnResume;
        ScannerService.syncLibrary(undefined, isSilent);
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <GlobalSyncIndicator />
      <RootStack.Navigator screenOptions={{ headerShown: false, freezeOnBlur: false }}>
        <RootStack.Screen name="Main" component={MainTabs} />
        <RootStack.Screen
          name="Player"
          component={PlayerNavigator}
          options={{
            presentation: "transparentModal",
            animation: "slide_from_bottom",
          }}
        />
        <RootStack.Screen
          name="DebugHistory"
          component={DebugHistoryScreen}
          options={{
            animation: "slide_from_right",
          }}
        />
        <RootStack.Screen
          name="ShareStats"
          component={ActivityShareScreen}
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
        <RootStack.Screen
          name="ShareSong"
          component={SongShareScreen}
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
        <RootStack.Screen
          name="ShareLyrics"
          component={LyricsShareScreen}
          options={{
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
      </RootStack.Navigator>
    </View>
  );
}
