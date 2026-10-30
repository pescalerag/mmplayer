import { useEffect, useState } from 'react';
import type Album from '../database/models/Album';
import { AlbumCoverColorService, getStoredCoverColor } from '../services/AlbumCoverColorService';

export function useAlbumCoverColor(source: string | null | undefined, album?: Album | null): string | null {
    const stored = getStoredCoverColor(source, album);
    const [result, setResult] = useState<{ source: string; color: string | null } | null>(null);

    useEffect(() => {
        if (!source || stored) return;
        let cancelled = false;
        void AlbumCoverColorService.getColor(source, album).then(color => {
            if (!cancelled) setResult({ source, color });
        });
        return () => { cancelled = true; };
    }, [source, album, stored]);

    // Never show the preceding song's color while the next request is pending.
    return stored ?? (source && result?.source === source ? result.color : null);
}
