import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { ViewProps } from 'react-native';

const NativeEqualizerModule = requireNativeModule('NativeEqualizer');

export interface RuntimeTestResult {
    name: string;
    status: 'pass' | 'fail' | 'skip';
    detail: string;
    durationMs: number;
}
export const runNativeRuntimeDiagnostics = (): Promise<RuntimeTestResult[]> => NativeEqualizerModule.runRuntimeDiagnostics();
export const readNativeRuntimeErrors = (): Promise<string> => NativeEqualizerModule.readRuntimeErrors();
export const clearNativeRuntimeErrors = (): Promise<void> => NativeEqualizerModule.clearRuntimeErrors();

export interface NativeVisualizerProps extends ViewProps {
    color?: string;
    type?: 'bars' | 'wave' | 'spectrum' | 'circle';
    active?: boolean;
    coverColor?: string;
}

export const NativeVisualizer: React.ComponentType<NativeVisualizerProps> = requireNativeViewManager('NativeEqualizer');

export async function initializeEqualizer(audioSessionId: number = 0): Promise<void> {
    return await NativeEqualizerModule.initialize(audioSessionId);
}

export async function setEqualizerEnabled(enabled: boolean): Promise<void> {
    return await NativeEqualizerModule.setEnabled(enabled);
}

export async function setEqualizerBandLevel(band: number, levelMb: number): Promise<void> {
    return await NativeEqualizerModule.setBandLevel(band, levelMb);
}

export async function setEqualizerBassBoost(strength: number): Promise<void> {
    return await NativeEqualizerModule.setBassBoost(strength);
}

export async function getEqualizerBandFrequencies(): Promise<number[]> {
    return await NativeEqualizerModule.getBandFrequencies();
}

export async function getEqualizerBandLevelRange(): Promise<{ min: number; max: number }> {
    return await NativeEqualizerModule.getBandLevelRange();
}

export async function getEqualizerNumberOfBands(): Promise<number> {
    return await NativeEqualizerModule.getNumberOfBands();
}

export async function releaseEqualizer(): Promise<void> {
    return await NativeEqualizerModule.release();
}

export async function extractColorFromImage(imageUrl: string): Promise<string | null> {
    return await NativeEqualizerModule.extractColorFromImage(imageUrl);
}

export async function setReplayGainSettings(enabled: boolean, preamp: number, fallback: number): Promise<void> {
    return NativeEqualizerModule.setReplayGainSettings(enabled, preamp, fallback);
}

export async function setCrossfadeSettings(seconds: number, allowed: boolean): Promise<void> {
    return NativeEqualizerModule.setCrossfadeSettings(seconds, allowed);
}

export function setNativeTransportPlaying(playing: boolean, volume: number, durationMs: number): Promise<void> {
    return NativeEqualizerModule.setTransportPlaying(playing, volume, durationMs);
}

export async function getNativePlaybackSnapshot(): Promise<{
    queue: import('react-native-track-player').Track[];
    index: number;
    progress: import('react-native-track-player').Progress;
    repeatMode: number;
    queueRevision: number;
    userQueueSize: number;
} | null> {
    return NativeEqualizerModule.getPlaybackSnapshot?.() ?? null;
}
