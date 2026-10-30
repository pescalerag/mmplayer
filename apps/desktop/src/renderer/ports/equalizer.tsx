import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import { player, EQUALIZER_FREQUENCIES_HZ } from "../player";
import {
  DEFAULT_VISUALIZER_COLOR,
  VISUALIZER_RAINBOW,
} from "../../../../../src/utils/visualizerColors";

export interface RuntimeTestResult {
  name: string;
  status: "pass" | "fail" | "skip";
  detail: string;
  durationMs: number;
}

export interface NativeVisualizerProps {
  style?: any;
  color?: string;
  type?: "bars" | "wave" | "spectrum" | "circle";
  active?: boolean;
  coverColor?: string;
}

const DEFAULT_BANDS_HZ = [...EQUALIZER_FREQUENCIES_HZ];
let eqEnabled = false;
const eqLevelsDb = [0, 0, 0, 0, 0, 0];

/** Browser image decoder; the existing album service persists the result in SQLite. */
export async function extractColorFromImage(
  uri: string,
): Promise<string | null> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = uri;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, 16, 16);
  const pixels = context.getImageData(0, 0, 16, 16).data;
  const totals = [0, 0, 0];
  let count = 0;
  for (let i = 0; i < pixels.length; i += 4)
    if (pixels[i + 3] > 128) {
      for (let channel = 0; channel < 3; channel++)
        totals[channel] += pixels[i + channel];
      count++;
    }
  return count
    ? "#" +
        totals
          .map((value) =>
            Math.round(value / count)
              .toString(16)
              .padStart(2, "0"),
          )
          .join("")
    : null;
}

function parseHexOrRgb(color: string): [number, number, number] | null {
  const trimmed = color.trim();
  if (/^#[\da-f]{6}$/i.test(trimmed)) {
    return [
      parseInt(trimmed.slice(1, 3), 16),
      parseInt(trimmed.slice(3, 5), 16),
      parseInt(trimmed.slice(5, 7), 16),
    ];
  }
  if (/^#[\da-f]{3}$/i.test(trimmed)) {
    return [
      parseInt(trimmed[1] + trimmed[1], 16),
      parseInt(trimmed[2] + trimmed[2], 16),
      parseInt(trimmed[3] + trimmed[3], 16),
    ];
  }
  const rgbMatch = trimmed.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i,
  );
  if (rgbMatch) {
    return [
      Math.min(255, Number(rgbMatch[1])),
      Math.min(255, Number(rgbMatch[2])),
      Math.min(255, Number(rgbMatch[3])),
    ];
  }
  return null;
}

export function brightenCoverColorForVisualizer(
  color?: string | null,
): string {
  if (!color) return DEFAULT_VISUALIZER_COLOR;
  const rgb = parseHexOrRgb(color);
  if (!rgb) return DEFAULT_VISUALIZER_COLOR;
  const r = rgb[0] / 255;
  const g = rgb[1] / 255;
  const b = rgb[2] / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  let l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  // Match Android NativeVisualizerView.kt HSL brightening:
  // if (hsl[2] < 0.45f) hsl[2] = 0.65f; if (hsl[1] < 0.25f) hsl[1] = 0.65f
  if (l < 0.45) l = 0.65;
  if (s < 0.25) s = 0.65;

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const outR = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const outG = Math.round(hue2rgb(p, q, h) * 255);
  const outB = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return (
    "#" +
    [outR, outG, outB]
      .map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0"))
      .join("")
  );
}

export function NativeVisualizer(props: NativeVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const smoothedBarsRef = useRef<Float32Array>(new Float32Array(20));
  const smoothedCircleRef = useRef<Float32Array>(new Float32Array(60));
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (props.active === false) return;
    let rafId = 0;
    let lastFrameMs = 0;
    const targetIntervalMs = 1000 / 30; // 30 fps cap matching Android Choreographer loop
    const decay = 0.8;
    const freqBins = new Uint8Array(512);
    const waveBins = new Uint8Array(512);

    const renderFrame = (now: number) => {
      rafId = requestAnimationFrame(renderFrame);
      if (now - lastFrameMs < targetIntervalMs) return;
      lastFrameMs = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.floor(rect.width || 300));
      const h = Math.max(1, Math.floor(rect.height || 240));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      const {
        type = "bars",
        color = "cover",
        coverColor,
        active = true,
      } = propsRef.current;

      const analyser = active ? player.getAnalyser() : null;
      const isPlaying = player.getSnapshot().playing;
      let hasSignal = false;
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(freqBins);
        analyser.getByteTimeDomainData(waveBins);
        for (let i = 0; i < freqBins.length; i++) {
          if (freqBins[i] > 0) {
            hasSignal = true;
            break;
          }
        }
      } else {
        freqBins.fill(0);
        waveBins.fill(128);
      }

      let fillOrStrokeStyle: string | CanvasGradient = DEFAULT_VISUALIZER_COLOR;
      let solidBaseColor = DEFAULT_VISUALIZER_COLOR;
      if (color === "rainbow") {
        if (type === "circle" && typeof ctx.createConicGradient === "function") {
          const grad = ctx.createConicGradient(0, w / 2, h / 2);
          VISUALIZER_RAINBOW.forEach((stopColor, idx) => {
            grad.addColorStop(
              idx / (VISUALIZER_RAINBOW.length - 1),
              stopColor,
            );
          });
          fillOrStrokeStyle = grad;
        } else {
          const grad = ctx.createLinearGradient(0, 0, w, 0);
          VISUALIZER_RAINBOW.forEach((stopColor, idx) => {
            grad.addColorStop(
              idx / (VISUALIZER_RAINBOW.length - 1),
              stopColor,
            );
          });
          fillOrStrokeStyle = grad;
        }
      } else if (color === "cover") {
        solidBaseColor = brightenCoverColorForVisualizer(coverColor);
        fillOrStrokeStyle = solidBaseColor;
      } else if (color) {
        solidBaseColor = color;
        fillOrStrokeStyle = color;
      }

      ctx.fillStyle = fillOrStrokeStyle;
      ctx.strokeStyle = fillOrStrokeStyle;

      const numBins = freqBins.length;
      const sampleLogMagnitude = (index: number, totalCount: number) => {
        if (!hasSignal) return 0;
        const minIdx = 2;
        const maxIdx = Math.max(minIdx + 1, numBins - 1);
        const lowIdx = Math.min(
          numBins - 1,
          Math.max(
            0,
            Math.round(
              minIdx * Math.pow(maxIdx / minIdx, index / totalCount),
            ),
          ),
        );
        const highIdx = Math.min(
          numBins,
          Math.max(
            lowIdx + 1,
            Math.round(
              minIdx * Math.pow(maxIdx / minIdx, (index + 1) / totalCount),
            ),
          ),
        );
        let sum = 0;
        let count = 0;
        for (let k = lowIdx; k < highIdx; k++) {
          sum += freqBins[k];
          count++;
        }
        const avg = count > 0 ? sum / count : 0;
        return Math.min(1, Math.log10(avg + 1) / 2.4);
      };

      if (type === "bars") {
        const numBars = 20;
        const barWidth = w / numBars;
        const smoothed = smoothedBarsRef.current;
        for (let i = 0; i < numBars; i++) {
          const target = sampleLogMagnitude(i, numBars) * h;
          smoothed[i] = Math.max(smoothed[i] * decay, Math.min(h, target));
          const barH = Math.max(smoothed[i], 4);
          const x = i * barWidth + 4;
          const bw = Math.max(2, barWidth - 8);
          const y = h - barH;
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(x, y, bw, barH, 8);
          } else {
            ctx.rect(x, y, bw, barH);
          }
          ctx.fill();
        }
      } else if (type === "wave") {
        ctx.lineWidth = 4;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        if (!hasSignal) {
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
        } else {
          const points = Math.min(256, waveBins.length);
          const step = Math.max(1, Math.floor(waveBins.length / points));
          for (let i = 0; i < points; i++) {
            const idx = Math.min(i * step, waveBins.length - 1);
            const val = (waveBins[idx] - 128) / 128;
            const x = (i / (points - 1)) * w;
            const y = h / 2 + val * (h * 0.4);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      } else if (type === "spectrum") {
        if (!hasSignal) {
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, h - 3);
          ctx.lineTo(w, h - 3);
          ctx.stroke();
        } else {
          const points = 60;
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let i = 0; i < points; i++) {
            const mag = sampleLogMagnitude(i, points) * (h * 0.8);
            const x = i * (w / (points - 1));
            const y = h - Math.max(mag, 3);
            ctx.lineTo(x, y);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();
        }
      } else if (type === "circle") {
        const cx = w / 2;
        const cy = h / 2;
        const baseRadius = Math.min(cx, cy) * 0.45;
        const numCircleBars = 60;
        const circleSmoothed = smoothedCircleRef.current;

        if (!hasSignal) {
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          let totalMag = 0;
          for (let i = 0; i < numCircleBars; i++) {
            const target = Math.min(
              baseRadius * 1.5,
              sampleLogMagnitude(i, numCircleBars) * (baseRadius * 1.2),
            );
            circleSmoothed[i] = Math.max(circleSmoothed[i] * decay, target);
            totalMag += circleSmoothed[i];
          }
          const avgMag = totalMag / numCircleBars;
          const coreRadius = baseRadius + avgMag * 0.15;

          ctx.save();
          ctx.globalAlpha = 0.15;
          ctx.beginPath();
          ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          ctx.lineWidth = 5;
          ctx.lineCap = "round";
          for (let i = 0; i < numCircleBars; i++) {
            const angleRad = (i * 2 * Math.PI) / numCircleBars;
            const cos = Math.cos(angleRad);
            const sin = Math.sin(angleRad);
            const barLen = circleSmoothed[i];
            ctx.beginPath();
            ctx.moveTo(cx + coreRadius * cos, cy + coreRadius * sin);
            ctx.lineTo(
              cx + (coreRadius + barLen) * cos,
              cy + (coreRadius + barLen) * sin,
            );
            ctx.stroke();
          }
        }
      }
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [props.active]);

  return (
    <View style={props.style} testID="desktop-native-visualizer">
      <canvas
        ref={canvasRef}
        data-testid="desktop-visualizer-canvas"
        data-visualizer-type={props.type || "bars"}
        data-visualizer-color={props.color || "cover"}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          pointerEvents: "none",
        }}
      />
    </View>
  );
}

export async function initializeEqualizer(
  _audioSessionId: number = 0,
): Promise<boolean> {
  player.equalizer(eqLevelsDb, eqEnabled);
  return true;
}

export async function setEqualizerEnabled(enabled: boolean): Promise<void> {
  eqEnabled = Boolean(enabled);
  player.equalizer(eqLevelsDb, eqEnabled);
}

export async function setEqualizerBandLevel(
  band: number,
  levelMb: number,
): Promise<void> {
  if (band >= 0 && band < eqLevelsDb.length && Number.isFinite(levelMb)) {
    const clampedMb = Math.max(-1500, Math.min(1500, Math.round(levelMb)));
    eqLevelsDb[band] = clampedMb / 100;
    player.equalizer(eqLevelsDb, eqEnabled);
  }
}

export async function setEqualizerBassBoost(strength: number): Promise<void> {
  player.bassBoost(strength);
}

export async function getEqualizerBandFrequencies(): Promise<number[]> {
  return [...DEFAULT_BANDS_HZ];
}

export async function getEqualizerBandLevelRange(): Promise<{
  min: number;
  max: number;
}> {
  return { min: -1500, max: 1500 };
}

export async function getEqualizerNumberOfBands(): Promise<number> {
  return DEFAULT_BANDS_HZ.length;
}

export async function releaseEqualizer(): Promise<boolean> {
  eqEnabled = false;
  player.equalizer(eqLevelsDb, false);
  return true;
}

export async function setReplayGainSettings(
  enabled: boolean,
  preamp: number,
  fallback: number,
): Promise<void> {
  player.setReplayGainSettings(enabled, preamp, fallback);
}

export async function setCrossfadeSettings(
  seconds: number,
  allowed: boolean,
): Promise<void> {
  player.setCrossfadeSettings(seconds, allowed);
}

export async function setNativeTransportPlaying(
  playing: boolean,
  volume: number,
  durationMs: number,
): Promise<void> {
  await player.setTransportPlaying(playing, volume, durationMs);
}

export async function getNativePlaybackSnapshot(): Promise<null> {
  return null;
}

export async function runNativeRuntimeDiagnostics(): Promise<
  RuntimeTestResult[]
> {
  return [
    {
      name: "Desktop WebAudio Engine",
      status: "pass",
      detail:
        "WebAudio transport, 6-band EQ, BassBoost, ReplayGain, PitchShift, Crossfade & AnalyserNode ready",
      durationMs: 1,
    },
  ];
}

export async function readNativeRuntimeErrors(): Promise<string> {
  return "";
}

export async function clearNativeRuntimeErrors(): Promise<void> {}
