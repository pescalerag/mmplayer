/**
 * Formatea una duración en segundos al formato de pista m:ss (ej: 3:45)
 */
export const formatTrackTime = (seconds?: number | null): string => {
    if (!seconds || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

/**
 * Formatea una duración total (de un álbum) al formato X h Y min o X min
 */
export const formatAlbumDuration = (seconds?: number | null): string => {
    if (!seconds || seconds <= 0) return '0 min';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    
    if (h > 0) {
        return m > 0 ? `${h} h ${m} min` : `${h} h`;
    }
    return `${m} min`;
};
