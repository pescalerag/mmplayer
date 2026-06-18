import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { AppState, AppStateStatus, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlobalSyncIndicator from "../components/GlobalSyncIndicator";
import { ScannerService } from "../services/ScannerService";
import { useSettingsStore } from "../store/useSettingsStore";
import { Colors } from "../theme/theme";

import MiniPlayer from "../components/MiniPlayer";
import DebugHistoryScreen from "../screens/DebugHistoryScreen";
import TagsNavigator from "./TagsNavigator";
import HomeNavigator from "./HomeNavigator";
import LibraryNavigator from "./LibraryNavigator";
import PlayerNavigator from "./PlayerNavigator";
import SearchNavigator from "./SearchNavigator";
import SettingsNavigator from "./SettingsNavigator";
import { RootStackParamList } from "./types";

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator<RootStackParamList>();

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

  const screenOptions = React.useMemo(
    () => ({
      tabBarShowLabel: false,
      tabBarActiveTintColor: Colors.tabIconSelected,
      tabBarInactiveTintColor: Colors.tabIconDefault,
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
      unmountOnBlur: true,
    }),
    [insets],
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
          bottom: 60 + insets.bottom + 12,
          left: 12,
          right: 12,
          zIndex: 100,
        }}
      >
        <MiniPlayer />
      </View>
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
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main" component={MainTabs} />
        <RootStack.Screen
          name="Player"
          component={PlayerNavigator}
          options={{
            presentation: "modal",
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
      </RootStack.Navigator>
    </View>
  );
}
