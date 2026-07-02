import { requireNativeModule, requireNativeViewManager } from 'expo-modules-core';
import React from 'react';
import { ViewProps } from 'react-native';

const NativeEqualizerModule = requireNativeModule('NativeEqualizer');

export interface NativeVisualizerProps extends ViewProps {
    color?: string;
    type?: 'bars' | 'wave' | 'spectrum' | 'circle';
    active?: boolean;
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
