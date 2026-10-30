import React, { useState } from "react";
import { create } from "zustand";
import { useTranslation } from "react-i18next";
import type { DesktopPreferences } from "@mmplayer/platform";
import { Icon } from "./Icon";
import { desktopMenus } from "./desktopMenus";
import type { DesktopMenuEntry } from "./desktopMenuStack";
import { useToastStore } from "../../../../src/store/useToastStore";

type Shortcut = DesktopPreferences["pinnedShortcuts"][number];
export const useDesktopPins = create<{ items: Shortcut[] }>(() => ({ items: [] }));
export function syncDesktopPins(preferences: DesktopPreferences) {
  useDesktopPins.setState({ items: preferences.pinnedShortcuts || [] });
}
export function DesktopPinAction({ entry }: { entry: DesktopMenuEntry }) {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const items = useDesktopPins(state => state.items);
  const props = entry.props as any;
  const item: Shortcut | null = entry.type === "tag-menu" && props?.tag
    ? { kind: "tag", id: props.tag.id, name: props.tag.name }
    : entry.type === "folder-menu" && props?.folderPath
      ? { kind: "folder", id: props.folderPath, name: props.folderName || props.folderPath.split("/").pop() || props.folderPath }
      : null;
  if (!item) return null;
  const pinned = items.some(pin => pin.kind === item.kind && pin.id === item.id);
  return <button className="desktop-pin-action" disabled={saving} onClick={async () => {
    setSaving(true);
    try {
      const next = pinned ? items.filter(pin => pin.kind !== item.kind || pin.id !== item.id) : [...items, item];
      const preferences = await window.mmplayer.invoke("preferences", { pinnedShortcuts: next });
      syncDesktopPins(preferences);
      desktopMenus.close(entry.id);
    } catch (error) {
      console.error("Could not save pinned shortcut:", error);
      useToastStore.getState().showToast(t("common.error"), "alert-circle-outline");
    } finally { setSaving(false); }
  }}><Icon name="pin" />{t(pinned ? "actions.unpin_library" : "actions.pin_library")}</button>;
}
