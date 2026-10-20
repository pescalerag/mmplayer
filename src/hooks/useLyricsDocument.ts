import { useEffect, useState } from 'react';
import { database } from '../database';
import Track from '../database/models/Track';

/** The initial text is a snapshot: DB emissions must never replace an editor draft. */
export function useLyricsDocument(trackId: string) {
    const [document, setDocument] = useState<{ track: Track; text: string } | null>(null);
    const [missing, setMissing] = useState(false);
    useEffect(() => {
        setDocument(null); setMissing(false);
        const subscription = database.get<Track>('tracks').findAndObserve(trackId).subscribe({
            next: track => setDocument(previous => previous ?? { track, text: track.lyricsLRC || '' }),
            error: () => { setDocument(null); setMissing(true); },
            complete: () => { setDocument(null); setMissing(true); },
        });
        return () => subscription.unsubscribe();
    }, [trackId]);
    return { document: document?.track.id === trackId ? document : null, missing };
}
