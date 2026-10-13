export function getPlayerLyricsPresentation(hasLyrics: boolean, currentPhrase: string) {
    const hasPhrase = hasLyrics && currentPhrase.trim() !== '';
    // Native fades can be suspended while this screen is covered, leaving a
    // nonempty phrase at opacity zero. Render visibility with the phrase itself.
    return {
        // Keep the same slot even on songs without lyrics so artwork never grows
        // and shrinks as tracks change or lyrics finish loading.
        lyricsAnimatedStyle: { height: 46, opacity: hasLyrics ? 1 : 0 },
        textAnimatedStyle: { opacity: hasPhrase ? 1 : 0 },
        activeLyricText: hasLyrics ? currentPhrase : '',
    };
}
