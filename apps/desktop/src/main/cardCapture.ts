import { BrowserWindow, nativeImage } from "electron";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { DesktopCommands } from "@mmplayer/platform";

export async function captureCard(input: DesktopCommands["captureCard"]["input"], directory: string) {
  if (!input || typeof input.html !== "string" || input.html.length > 32 * 1024 * 1024 ||
      ![input.width,input.height,input.outputWidth,input.outputHeight].every(value => Number.isFinite(value) && value >= 1 && value <= 4096) ||
      !["png","jpg","jpeg"].includes(input.format) || !Number.isFinite(input.quality)) throw Error("Invalid card capture");
  const width = Math.round(input.outputWidth), height = Math.round(input.outputHeight);
  const capture = new BrowserWindow({ width, height, useContentSize: true, show: false, frame: false,
    webPreferences: { offscreen: true, sandbox: true, nodeIntegration: false, contextIsolation: true, partition: "card-" + randomUUID(), backgroundThrottling: false } });
  const timeout = setTimeout(() => { if (!capture.isDestroyed()) capture.destroy(); }, 15000);
  try {
    capture.setMenu(null);capture.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    capture.webContents.session.webRequest.onBeforeRequest((request, done) => done({ cancel: !request.url.startsWith("data:") }));
    // No page scripts, network resources, app protocol or preload bridge.
    const csp = "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'none'; base-uri 'none'\">";
    if (!input.html.includes("<head>")) throw Error("Invalid card document");
    const html = input.html.replace("<head>", "<head>" + csp);
    await capture.loadURL("data:text/html;charset=utf-8," + encodeURIComponent("<!doctype html><html><head>" + csp + "</head><body></body></html>"));
    capture.webContents.setZoomFactor(1);
    capture.webContents.debugger.attach("1.3");
    await capture.webContents.debugger.sendCommand("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: false });
    const tree = await capture.webContents.debugger.sendCommand("Page.getFrameTree");
    await capture.webContents.debugger.sendCommand("Page.setDocumentContent", { frameId: tree.frameTree.frame.id, html });
    await capture.webContents.executeJavaScript(`(async()=>{
      const root=document.getElementById('capture');root.style.width=${input.width}+'px';root.style.height=${input.height}+'px';root.style.zoom=${width / input.width};
      await document.fonts.ready;
      await Promise.all([...document.images].map(image=>image.decode()));
      await new Promise(resolve=>setTimeout(resolve,100));
    })()`);

    const shot = await capture.webContents.debugger.sendCommand("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, fromSurface: true, clip: { x: 0, y: 0, width, height, scale: 1 } });
    const image = nativeImage.createFromBuffer(Buffer.from(shot.data, "base64"));
    const extension = input.format === "png" ? "png" : "jpg", name = "MMPlayer-card-" + randomUUID() + "." + extension;
    await mkdir(join(directory,"app-cache"), { recursive: true });
    await writeFile(join(directory,"app-cache",name), extension === "png" ? image.toPNG() : image.toJPEG(Math.round(Math.max(0,Math.min(1,input.quality))*100)));
    return "mmplayer-media://asset/app-cache/" + name;
  } finally { clearTimeout(timeout); if (!capture.isDestroyed()) capture.destroy(); }
}
