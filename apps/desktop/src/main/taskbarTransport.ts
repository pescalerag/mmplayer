import { nativeImage, type BrowserWindow } from "electron";
import type { TransportAction } from "@mmplayer/platform";

function icon(kind: "previous" | "next" | "play" | "pause") {
  const size = 24,
    pixels = Buffer.alloc(size * size * 4);
  for (let y = 4; y < 20; y++)
    for (let x = 4; x < 20; x++) {
      const px = kind === "previous" ? 23 - x : x;
      const lit =
        kind === "pause"
          ? x < 10 || x > 13
          : (px >= 7 && px <= 18 - Math.abs(y - 11.5)) ||
            (kind !== "play" && px >= 18);
      if (lit) pixels.fill(255, (y * size + x) * 4, (y * size + x) * 4 + 4);
    }
  return nativeImage.createFromBitmap(pixels, { width: size, height: size });
}

export class TaskbarTransport {
  get configured() {
    return this.signature.length > 0;
  }
  private signature = "";
  private last?: {
    state: {
      playing: boolean;
      available: boolean;
      title: string;
      artist: string;
    };
    language: string;
  };
  constructor(
    private window: BrowserWindow,
    private send: (action: TransportAction) => void,
  ) {
    window.on("show", () => {
      this.signature = "";
      if (this.last) this.update(this.last.state, this.last.language);
    });
  }
  update(
    state: {
      playing: boolean;
      available: boolean;
      title: string;
      artist: string;
    },
    language = "en",
  ) {
    this.last = { state, language };
    this.window.setTitle(
      state.title ? `${state.title} — ${state.artist} | MMPlayer` : "MMPlayer",
    );
    if (process.platform !== "win32") return;
    const signature = `${state.playing}/${state.available}/${language}`;
    if (signature === this.signature) return;
    const labels =
      language === "es"
        ? ["Anterior", "Reproducir", "Pausar", "Siguiente"]
        : language === "pt"
          ? ["Anterior", "Reproduzir", "Pausar", "Seguinte"]
          : ["Previous", "Play", "Pause", "Next"];
    const applied = this.window.setThumbarButtons([
      {
        tooltip: labels[0],
        icon: icon("previous"),
        flags: state.available ? [] : ["disabled"],
        click: () => this.send("previous"),
      },
      {
        tooltip: labels[state.playing ? 2 : 1],
        icon: icon(state.playing ? "pause" : "play"),
        flags: state.available ? [] : ["disabled"],
        click: () => this.send("toggle"),
      },
      {
        tooltip: labels[3],
        icon: icon("next"),
        flags: state.available ? [] : ["disabled"],
        click: () => this.send("next"),
      },
    ]);
    if (applied) this.signature = signature;
  }
}
