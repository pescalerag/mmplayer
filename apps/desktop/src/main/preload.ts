import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { DesktopBridge, DesktopEvents } from "@mmplayer/platform";
const bridge: DesktopBridge = {
  importDroppedFiles: (files) => {
    const paths = files
      .map((file) => webUtils.getPathForFile(file))
      .filter(Boolean);
    return ipcRenderer.invoke("mmplayer:drop", paths);
  },
  onBeforeClose: (handler) => {
    const receive = () => {
      void handler()
        .catch((error) =>
          console.error("Could not save playback before closing:", error),
        )
        .finally(() => ipcRenderer.send("mmplayer:close-ready"));
    };
    ipcRenderer.on("mmplayer:before-close", receive);
    return () => {
      ipcRenderer.removeListener("mmplayer:before-close", receive);
    };
  },
  invoke: (command, input) =>
    ipcRenderer.invoke("mmplayer:invoke", command, input),
  on: (event, listener) => {
    const receive = (
      _event: Electron.IpcRendererEvent,
      message: { event: keyof DesktopEvents; data: never },
    ) => {
      if (message.event === event) listener(message.data);
    };
    ipcRenderer.on("mmplayer:event", receive);
    return () => {
      ipcRenderer.removeListener("mmplayer:event", receive);
    };
  },
};
contextBridge.exposeInMainWorld("mmplayer", bridge);
