import { normalizeOpaqueColor } from './customColors';

export type VisualizerColorMode = 'cover' | 'accent' | 'rainbow' | 'custom';

export const DEFAULT_VISUALIZER_COLOR = '#8B5CF6';
export const VISUALIZER_RAINBOW = ['#FF4545', '#FFAA33', '#FFEB3B', '#4ADE80', '#38BDF8', '#A78BFA', '#FF4545'] as const;

export function resolveVisualizerColor(mode: VisualizerColorMode, accent: string, custom: string): string {
  if (mode === 'cover' || mode === 'rainbow') return mode;
  if (mode === 'custom') return normalizeOpaqueColor(custom, DEFAULT_VISUALIZER_COLOR);
  return accent;
}
