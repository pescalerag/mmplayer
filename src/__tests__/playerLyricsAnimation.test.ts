import { getPlayerLyricsPresentation } from '../utils/playerLyricsPresentation';

// A covered screen can suspend native animations indefinitely.
jest.mock('react-native-reanimated', () => ({
    useSharedValue: () => { throw new Error('Native animation suspended'); },
    withTiming: () => { throw new Error('Native animation suspended'); },
}));

describe('PlayerScreen lyric visibility', () => {
    it('shows lyrics loaded after opening the player without a navigation event', () => {
        getPlayerLyricsPresentation(false, '');
        const waiting = getPlayerLyricsPresentation(true, '');
        expect(waiting.lyricsAnimatedStyle.height).toBe(46);
        expect(waiting.activeLyricText).toBe('');
        const playing = getPlayerLyricsPresentation(true, 'First line');
        expect(playing.activeLyricText).toBe('First line');
        expect(playing.lyricsAnimatedStyle.opacity).toBe(1);
        expect(playing.textAnimatedStyle.opacity).toBe(1);
    });

    it('shows every phrase even when native animations cannot run', () => {
        for (let i = 0; i < 100; i++) {
            const result = getPlayerLyricsPresentation(true, `Line ${i}`);
            expect(result.activeLyricText).toBe(`Line ${i}`);
            expect(result.textAnimatedStyle.opacity).toBe(1);
        }
    });

    it('keeps instrumental intervals blank and immediately shows the following phrase', () => {
        getPlayerLyricsPresentation(true, 'Before instrumental');
        const instrumental = getPlayerLyricsPresentation(true, '');
        expect(instrumental.activeLyricText).toBe('');
        expect(instrumental.textAnimatedStyle.opacity).toBe(0);
        expect(instrumental.lyricsAnimatedStyle.height).toBe(46);
        const following = getPlayerLyricsPresentation(true, 'After instrumental');
        expect(following.activeLyricText).toBe('After instrumental');
        expect(following.textAnimatedStyle.opacity).toBe(1);
    });

    it('clears previous lyrics when disabled or switching to a song without lyrics', () => {
        getPlayerLyricsPresentation(true, 'Old song');
        const result = getPlayerLyricsPresentation(false, 'Old song');
        expect(result.activeLyricText).toBe('');
        expect(result.lyricsAnimatedStyle).toEqual({ height: 46, opacity: 0 });
        expect(result.textAnimatedStyle.opacity).toBe(0);
    });
});
