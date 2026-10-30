import type { DesktopBridge } from "@mmplayer/platform";
declare global {
  interface Window {
    mmplayer: DesktopBridge;
  }
}
export {};
