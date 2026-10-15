import React from 'react';
import { VinylArtwork } from './VinylArtwork';
import { CdArtwork } from './CdArtwork';

interface PlayerDiscArtworkProps {
    playerCoverStyle: 'cd' | 'vinyl';
    album: { cdArtUrl: string | null } | null;
    artworkSize: number;
    spinStyle: any;
    coverColor: string | null;
    coverUrl?: string | null;
    holeSize?: number;
    onReady?: () => void;
}

export const PlayerDiscArtwork = React.memo(({ playerCoverStyle, album, artworkSize, spinStyle, coverColor, coverUrl, holeSize = 35, onReady }: Readonly<PlayerDiscArtworkProps>) => {
    if (playerCoverStyle === 'cd') {
        return <CdArtwork size={artworkSize} customImageUrl={album?.cdArtUrl} coverUrl={coverUrl} spinStyle={spinStyle} holeSize={holeSize} onReady={onReady} />;
    }

    return <VinylArtwork size={artworkSize} coverUrl={coverUrl} coverColor={coverColor} spinStyle={spinStyle} onReady={onReady} />;
});
PlayerDiscArtwork.displayName = 'PlayerDiscArtwork';
