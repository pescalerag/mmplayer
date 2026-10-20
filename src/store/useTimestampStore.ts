import { create } from 'zustand';
import { EMPTY_SKIP_CONFIG, SkipConfig } from '../utils/trackTimestamps';

export const useTimestampStore = create<{
    trackId: string | null; config: SkipConfig; previewTrackId: string | null; previewConfig: SkipConfig | null;
}>(() => ({ trackId: null, config: EMPTY_SKIP_CONFIG, previewTrackId: null, previewConfig: null }));
