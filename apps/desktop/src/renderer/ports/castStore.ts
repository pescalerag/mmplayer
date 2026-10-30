import { create } from "zustand";
// Casting is deliberately absent from the desktop composition.
export const useCastStore = create<any>(() => ({
  isLocalCastActive: false,
  isChromecastConnected: false,
  isCastPlaying: false,
}));
