import { create } from "zustand";
import { player } from "../player";
import { useToastStore } from "../../../../../src/store/useToastStore";
import { useCastStore } from "./castStore";
import i18n from "../../../../../src/constants/i18n";
import { useTimestampStore } from "../../../../../src/store/useTimestampStore";
import {
  evaluateABButtonPress,
  shouldTriggerABLoop,
} from "../../../../../src/utils/trackTimestamps";
import { TimestampService } from "./timestampService";

export interface ABRepeatState {
  pointA: number | null;
  pointB: number | null;
  setPointA: (time: number | null) => void;
  setPointB: (time: number | null) => void;
  clearAB: () => void;
  reset: () => void;
  handleButtonPress: (currentPosition?: number) => void;
  handleLongPress: () => void;
  checkLoop: (currentPosition: number) => Promise<number | null>;
}

let syncingFromPlayer = false;

export const useABRepeatStore = create<ABRepeatState>((set, get) => ({
  pointA: null,
  pointB: null,
  setPointA: (time) => {
    set({ pointA: time });
    if (!syncingFromPlayer) {
      player.setAB(time, time === null ? null : get().pointB);
    }
  },
  setPointB: (time) => {
    set({ pointB: time });
    if (!syncingFromPlayer) {
      player.setAB(get().pointA, time);
    }
  },
  clearAB: () => {
    set({ pointA: null, pointB: null });
    if (!syncingFromPlayer) {
      player.setAB(null, null);
    }
  },
  reset: () => {
    set({ pointA: null, pointB: null });
    if (!syncingFromPlayer) {
      player.setAB(null, null);
    }
  },
  handleButtonPress: (currentPosition?: number) => {
    const pos =
      typeof currentPosition === "number" && Number.isFinite(currentPosition)
        ? currentPosition
        : player.getSnapshot().position;
    const { pointA, pointB } = get();
    const action = evaluateABButtonPress(
      pointA,
      pointB,
      pos,
      useTimestampStore.getState().config,
    );
    if (action.type === "reject_b_muted") {
      useToastStore
        .getState()
        .showToast(i18n.t(action.toastKey), action.toastIcon);
      return;
    }
    set({ pointA: action.pointA, pointB: action.pointB });
    player.setAB(action.pointA, action.pointB);
    useToastStore
      .getState()
      .showToast(i18n.t(action.toastKey), action.toastIcon);
  },
  handleLongPress: () => {
    const { pointA, pointB } = get();
    if (pointA !== null || pointB !== null) {
      set({ pointA: null, pointB: null });
      player.setAB(null, null);
      useToastStore
        .getState()
        .showToast(i18n.t("toasts.ab_deactivated"), "close-outline");
    }
  },
  checkLoop: async (currentPosition) => {
    const timestamps = useTimestampStore.getState();
    if (
      timestamps.trackId &&
      timestamps.previewTrackId === timestamps.trackId
    ) {
      return null;
    }
    if (useCastStore.getState().isServerRunning) {
      return null;
    }
    const { pointA, pointB } = get();
    if (pointA !== null && pointB !== null && pointA < pointB) {
      if (TimestampService.nativeHandlesAB()) return null;
      const target = shouldTriggerABLoop(currentPosition, pointA, pointB);
      if (target !== null) {
        try {
          await TimestampService.seekAutomatically(target);
          return target;
        } catch (err) {
          console.error("Error seeking to point A in loop:", err);
        }
      }
    }
    return null;
  },
}));

player.subscribe(() => {
  const ab = player.getSnapshot().ab;
  const nextA = ab?.a ?? null;
  const nextB = ab?.b ?? null;
  const cur = useABRepeatStore.getState();
  if (cur.pointA !== nextA || cur.pointB !== nextB) {
    syncingFromPlayer = true;
    try {
      useABRepeatStore.setState({ pointA: nextA, pointB: nextB });
    } finally {
      syncingFromPlayer = false;
    }
  }
});
