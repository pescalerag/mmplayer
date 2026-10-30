import BackupBlockingModal from "../../../../src/components/modals/BackupBlockingModal";
import MigrationBlockingModal from "../../../../src/components/modals/MigrationBlockingModal";
import { useMigrationStore } from "../../../../src/store/useMigrationStore";
import { useBackupStore } from "../../../../src/store/useBackupStore";
import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import ActivityCustomDateModal from "../../../../src/components/modals/ActivityCustomDateModal";
import QueueRenameModal from "../../../../src/components/modals/QueueRenameModal";
import ColorPickerModal from "../../../../src/components/modals/ColorPickerModal";
import { useCustomDateModalStore } from "../../../../src/store/useCustomDateModalStore";
import { useQueueRenameModalStore } from "../../../../src/store/useQueueRenameModalStore";
import { useColorPickerModalStore } from "../../../../src/store/useColorPickerModalStore";

/** Shared editing dialogs cover the window, above their contextual-menu parents. */
export function DesktopModalHost() {
  const migration = useMigrationStore(state => state.isVisible);
  const backup = useBackupStore(state => state.isVisible);
  const date = useCustomDateModalStore((state) => state.isVisible);
  const queue = useQueueRenameModalStore((state) => state.queueId !== null);
  const color = useColorPickerModalStore((state) => state.request !== null);
  useEffect(() => {
    if (!date && !queue && !color && !migration) return;
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (migration) useMigrationStore.getState().handleConfirmResponse('keep');
      else if (color) useColorPickerModalStore.getState().close();
      else if (date) useCustomDateModalStore.getState().close();
      else useQueueRenameModalStore.getState().close();
    };
    document.addEventListener("keydown", key, true);
    return () => document.removeEventListener("keydown", key, true);
  }, [date, queue, color, migration]);
  if (!backup && !date && !queue && !color && !migration) return null;
  return createPortal(
    <div
      data-desktop-modal-layer
      style={{ position: "fixed", inset: 0, zIndex: backup ? 8000 : 10000 }}
    >
      <SafeAreaProvider style={{ position: "absolute", inset: 0 } as any}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <BackupBlockingModal />
          <MigrationBlockingModal />
          <ActivityCustomDateModal />
          <QueueRenameModal />
          <ColorPickerModal />
        </GestureHandlerRootView>
      </SafeAreaProvider>
    </div>,
    document.body,
  );
}
