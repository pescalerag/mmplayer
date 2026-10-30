import { DesktopPinAction } from "./pins";
import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { positionOverlay } from "../../../../packages/core/src/overlayPosition";
import { desktopMenus, captureMenuOrigin } from "./desktopMenus";
import type { DesktopMenuEntry } from "./desktopMenuStack";
import { DesktopSheetContext } from "./ports/sheetProps";
import {
  Alert,
  AlertButton,
  StyleSheet,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NavigationContext } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { create } from "zustand";
import { useAppTheme } from "../../../../src/hooks/useAppTheme";
import { SheetType } from "../../../../src/store/useUIStore";
import { useColorPickerModalStore } from "../../../../src/store/useColorPickerModalStore";

import { navigationRef } from "./ports/navigationRef";

// Mobile Sheets & Modals
import PlaylistSelectorModal from "../../../../src/components/modals/PlaylistSelectorModal";
import TagFormModal from "../../../../src/components/modals/TagFormModal";
import TagManagerModal from "../../../../src/components/modals/TagManagerModal";
import AlbumMenuSheet from "../../../../src/components/sheets/AlbumMenuSheet";
import AppTabsOrderSheet from "../../../../src/components/sheets/AppTabsOrderSheet";
import ArtistMenuSheet from "../../../../src/components/sheets/ArtistMenuSheet";
import ArtistsListSheet from "../../../../src/components/sheets/ArtistsListSheet";
import FolderMenuSheet from "../../../../src/components/sheets/FolderMenuSheet";
import HomeSectionsSheet from "../../../../src/components/sheets/HomeSectionsSheet";
import LibraryTabsOrderSheet from "../../../../src/components/sheets/LibraryTabsOrderSheet";
import LyricsMenuSheet from "../../../../src/components/sheets/LyricsMenuSheet";
import MetadataEditorSheet from "../../../../src/components/sheets/MetadataEditorSheet";
import PlaylistMenuSheet from "../../../../src/components/sheets/PlaylistMenuSheet";
import PlayerMenuSheet from "../../../../src/components/sheets/PlayerMenuSheet";
import SleepTimerSheet from "../../../../src/components/sheets/SleepTimerSheet";
import SortModalSheet from "../../../../src/components/sheets/SortModalSheet";
import SpeedPitchSheet from "../../../../src/components/sheets/SpeedPitchSheet";
import SwipeActionSheet from "../../../../src/components/sheets/SwipeActionSheet";
import TagMenuSheet from "../../../../src/components/sheets/TagMenuSheet";
import TrackMenuSheet from "../../../../src/components/sheets/TrackMenuSheet";
import BatchMenuSheet from "../../../../src/components/sheets/BatchMenuSheet";
import AdvancedTagSearchSheet from "../../../../src/components/sheets/AdvancedTagSearchSheet";
import EditAliasSheet from "../../../../src/components/sheets/EditAliasSheet";
import QueueManageSheet from "../../../../src/components/sheets/QueueManageSheet";
import QueueDestinationSheet from "../../../../src/components/sheets/QueueDestinationSheet";
import CanvasManagerSheet from "../../../../src/components/sheets/CanvasManagerSheet";
import TrackDetailsSheet from "../../../../src/components/sheets/TrackDetailsSheet";
import NotificationSettingsSheet from "../../../../src/components/sheets/NotificationSettingsSheet";

interface AlertRequest {
  title: string;
  message?: string;
  buttons?: AlertButton[];
}

const useDesktopAlertStore = create<{
  request: AlertRequest | null;
  show: (req: AlertRequest) => void;
  close: () => void;
}>((set) => ({
  request: null,
  show: (request) => set({ request }),
  close: () => set({ request: null }),
}));

// Patch React Native Web's no-op Alert.alert so mobile sheets' confirmation dialogs work on desktop
Alert.alert = (title: string, message?: string, buttons?: AlertButton[]) => {
  useDesktopAlertStore.getState().show({ title, message, buttons });
};

export function DesktopAlertModal() {
  const { colors, fonts } = useAppTheme();
  const request = useDesktopAlertStore((state) => state.request);
  const close = useDesktopAlertStore((state) => state.close);

  if (!request) return null;

  const buttons: AlertButton[] =
    request.buttons && request.buttons.length > 0
      ? request.buttons
      : [{ text: "OK" }];

  return createPortal(
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.alertBackdrop,
        { position: "fixed" as any },
      ]}
    >
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={close}
      />
      <View
        style={[
          styles.alertCard,
          {
            backgroundColor: colors.sheetBackground || "#1A1A1A",
            borderColor: colors.cardBackground || "#2A2A2A",
          },
        ]}
      >
        <Text
          style={[
            styles.alertTitle,
            { color: colors.text, fontFamily: fonts.bold || fonts.regular },
          ]}
        >
          {request.title}
        </Text>
        {!!request.message && (
          <ScrollView
            style={{ flexShrink: 1, maxHeight: 400 }}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.alertMessage,
                {
                  color: colors.textSecondary || "#AAAAAA",
                  fontFamily: fonts.regular,
                },
              ]}
            >
              {request.message}
            </Text>
          </ScrollView>
        )}
        <View style={styles.alertButtonsRow}>
          {buttons.map((btn, index) => {
            const isDestructive = btn.style === "destructive";
            const isCancel = btn.style === "cancel";
            return (
              <TouchableOpacity
                key={index}
                style={[
                  styles.alertButton,
                  isCancel
                    ? { backgroundColor: "rgba(255,255,255,0.08)" }
                    : isDestructive
                      ? { backgroundColor: colors.heartIcon || "#EF4444" }
                      : { backgroundColor: colors.accent || "#8B5CF6" },
                ]}
                activeOpacity={0.8}
                onPress={() => {
                  close();
                  btn.onPress?.();
                }}
              >
                <Text
                  style={[
                    styles.alertButtonText,
                    {
                      color: isCancel
                        ? colors.text
                        : isDestructive
                          ? "#FFFFFF"
                          : colors.onAccent || "#FFFFFF",
                      fontFamily: fonts.bold || fonts.regular,
                    },
                  ]}
                >
                  {btn.text || "OK"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>,
    document.body,
  );
}

function renderSheetContent(sheet: string | null) {
  switch (sheet) {
    case "tag-form":
      return <TagFormModal embedded />;
    case "queue-destination":
      return <QueueDestinationSheet />;
    case "track-menu":
      return <TrackMenuSheet />;
    case "lyrics-menu":
      return <LyricsMenuSheet />;
    case "album-menu":
      return <AlbumMenuSheet />;
    case "artist-menu":
      return <ArtistMenuSheet />;
    case "sort-modal":
      return <SortModalSheet />;
    case "tag-manager":
      return <TagManagerModal />;
    case "tag-menu":
      return <TagMenuSheet />;
    case "playlist-selector":
      return <PlaylistSelectorModal />;
    case "playlist-menu":
      return <PlaylistMenuSheet />;
    case "folder-menu":
      return <FolderMenuSheet />;
    case "artists-list":
      return <ArtistsListSheet />;
    case "sleep-timer":
      return <SleepTimerSheet />;
    case "speed-pitch":
      return <SpeedPitchSheet />;
    case "library-tabs-order":
      return <LibraryTabsOrderSheet />;
    case "app-tabs-order":
      return <AppTabsOrderSheet />;
    case "home-sections":
      return <HomeSectionsSheet />;
    case "swipe-action":
      return <SwipeActionSheet />;
    case "metadata-editor":
      return <MetadataEditorSheet />;
    case "player-menu":
      return <PlayerMenuSheet />;
    case "batch-menu":
      return <BatchMenuSheet />;
    case "advanced-tag-search":
      return <AdvancedTagSearchSheet />;
    case "edit-alias":
      return <EditAliasSheet />;
    case "clear-queue":
      return <QueueManageSheet />;
    case "canvas-manager":
      return <CanvasManagerSheet />;
    case "track-details":
      return <TrackDetailsSheet />;
    case "notification-settings":
      return <NotificationSettingsSheet />;
    default:
      return null;
  }
}

// One body portal, outside the desktop grid and every screen's clipping region.
export function DesktopSheetHost() {
  const entries = useSyncExternalStore(
    desktopMenus.subscribe,
    desktopMenus.getSnapshot,
  );
  const isColorPickerOpen = useColorPickerModalStore(
    (state) => state.request !== null,
  );
  useEffect(() => {
    const capture = (event: Event) => captureMenuOrigin(event);
    const contextMenu = (event: MouseEvent) => capture(event);
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") capture(event);
      if (event.key === "Escape" && !isColorPickerOpen) {
        if (
          document.querySelector("[data-desktop-modal-layer]") ||
          useDesktopAlertStore.getState().request
        )
          return;
        if (!desktopMenus.getSnapshot().length) return;
        event.preventDefault();
        event.stopPropagation();
        desktopMenus.close();
      }
    };
    document.addEventListener("pointerdown", capture, true);
    document.addEventListener("click", capture, true); // Keyboard and accessible/programmatic activation.
    document.addEventListener("contextmenu", contextMenu, true);
    document.addEventListener("keydown", keys, true);
    return () => {
      document.removeEventListener("pointerdown", capture, true);
      document.removeEventListener("click", capture, true);
      document.removeEventListener("contextmenu", contextMenu, true);
      document.removeEventListener("keydown", keys, true);
    };
  }, [isColorPickerOpen]);

  const navigation = useMemo(
    () => ({
      navigate: (screen: string, params?: Record<string, unknown>) => {
        desktopMenus.clear();
        navigationRef.navigate(screen, params);
      },
      push: (screen: string, params?: Record<string, unknown>) => {
        desktopMenus.clear();
        navigationRef.navigate(screen, params);
      },
      goBack: () => {
        desktopMenus.clear();
        navigationRef.goBack();
      },
      canGoBack: () => true,
      isFocused: () => true,
      dispatch: (action: any) => {
        desktopMenus.clear();
        navigationRef.dispatch(action);
      },
      getState: () => navigationRef.getRootState(),
      getParent: () => undefined,
      setParams: () => {},
      setOptions: () => {},
      addListener: () => () => {},
      removeListener: () => {},
    }),
    [],
  );

  if (!entries.length) return null;
  return createPortal(
    <NavigationContext.Provider value={navigation as any}>
      <div
        data-desktop-menu-layer
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9000,
          pointerEvents: "none",
        }}
      >
        <div
          aria-hidden="true"
          style={{ position: "absolute", inset: 0, pointerEvents: "auto" }}
          onPointerDown={() => {
            if (!isColorPickerOpen) desktopMenus.clear();
          }}
        />
        {entries
          .filter(
            (entry) => entry.type !== "queue" && entry.type !== "local-cast",
          )
          .map((entry) => (
            <FloatingSheet key={entry.id} entry={entry} />
          ))}
      </div>
    </NavigationContext.Provider>,
    document.body,
  );
}

function FloatingSheet({ entry }: { entry: DesktopMenuEntry }) {
  const { colors } = useAppTheme();
  const { t } = useTranslation();
  const panel = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 340, height: 420 });
  const [anchor, setAnchor] = useState(entry.anchor);
  const [viewport, setViewport] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const wide = [
    "metadata-editor",
    "canvas-manager",
    "sort-modal",
    "home-sections",
    "player-menu",
  ].includes(entry.type);
  const width = Math.min(wide ? 460 : 340, viewport.width - 16);
  useLayoutEffect(() => {
    const element = panel.current!;
    const measure = () =>
      setSize((previous) => {
        const height = Math.min(
          Math.ceil(element.getBoundingClientRect().height),
          window.innerHeight - 16,
        );
        return previous.height === height && previous.width === width
          ? previous
          : { width, height };
      });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    const resize = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", resize);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
    };
  }, [width]);
  useEffect(() => {
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const first = panel.current?.querySelector<HTMLElement>(
      'input, button, [role="button"], [tabindex="0"]',
    );
    first?.focus({ preventScroll: true });
    return () => {
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  // Read after layout so children follow a parent that moved on window resize.
  useLayoutEffect(() => {
    if (entry.parentId === undefined) return;
    const parent = document.querySelector<HTMLElement>(
      `[data-desktop-menu-id="${entry.parentId}"]`,
    );
    if (!parent) return;
    const bounds = parent.getBoundingClientRect();
    const next = {
      ...entry.anchor,
      x: bounds.x,
      width: bounds.width,
      y: bounds.y + (entry.anchor.offsetY ?? 0),
    };
    setAnchor((previous) =>
      previous.x === next.x &&
      previous.y === next.y &&
      previous.width === next.width
        ? previous
        : next,
    );
  });
  const parent =
    entry.parentId === undefined
      ? null
      : document.querySelector<HTMLElement>(
          `[data-desktop-menu-id="${entry.parentId}"]`,
        );
  const preferredSide =
    parent?.dataset.desktopMenuSide === "left" ? "left" : "right";
  const position = positionOverlay(
    anchor,
    { width, height: size.height },
    viewport,
    !anchor.point,
    preferredSide,
  );
  return (
    <div
      ref={panel}
      data-desktop-menu-id={entry.id}
      data-desktop-menu-type={entry.type}
      data-desktop-menu-side={position.left < anchor.x ? "left" : "right"}
      style={{
        position: "fixed",
        ...position,
        maxHeight: Math.max(0, viewport.height - position.top - 8),
        overflowY: "auto",
        pointerEvents: "auto",
        boxSizing: "border-box",
        padding: 16,
        borderRadius: 12,
        background: colors.sheetBackground || "#181818",
        color: colors.text,
        border: `1px solid ${colors.cardBackground || "#333"}`,
        boxShadow: "0 12px 36px #0008",
      }}
    >
      <DesktopSheetContext.Provider value={entry}>
        <SafeAreaProvider
          style={{ flexGrow: 0 }}
          initialMetrics={{
            frame: { x: 0, y: 0, width, height: viewport.height },
            insets: { top: 0, bottom: 0, left: 0, right: 0 },
          }}
        >
          <GestureHandlerRootView style={{ flexGrow: 0 }}>
            <View style={{ alignItems: "flex-end", marginBottom: 8 }}>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={t("actions.cancel")}
                onPress={() => desktopMenus.close(entry.id)}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 18 }}>
                  ✕
                </Text>
              </TouchableOpacity>
            </View>
            <DesktopPinAction entry={entry} />
            {renderSheetContent(entry.type as SheetType)}
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </DesktopSheetContext.Provider>
    </div>
  );
}

const styles = StyleSheet.create({
  alertBackdrop: {
    zIndex: 12000,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  alertCard: {
    maxHeight: "90%",
    width: "100%",
    maxWidth: 400,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  alertMessage: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  alertButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    flexWrap: "wrap",
    gap: 10,
  },
  alertButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    minWidth: 80,
    alignItems: "center",
  },
  alertButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
