import { EqualizerService, BandLevelRange } from '../services/EqualizerService';

export function changeEqualizerBandFromTouch(band: number, locationY: number, height: number, range: BandLevelRange) {
    if (!Number.isFinite(locationY) || !Number.isFinite(height) || height <= 0) return Promise.resolve();
    const ratio = 1 - Math.max(0, Math.min(1, locationY / height));
    const level = Math.round(range.min + ratio * (range.max - range.min));
    return EqualizerService.setBandLevel(band, level);
}
