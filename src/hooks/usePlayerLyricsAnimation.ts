import { useEffect, useRef } from 'react';
import { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

export function usePlayerLyricsAnimation(hasLyrics: boolean, currentPhrase: string, isFocused: boolean) {
    const lyricsHeight = useSharedValue(hasLyrics ? 46 : 0);
    const lyricsOpacity = useSharedValue(hasLyrics ? 1 : 0);
    const hasPhrase = hasLyrics && currentPhrase.trim() !== '';
    const textOpacity = useSharedValue(hasPhrase ? 1 : 0);
    const wasFocused = useRef(isFocused);

    useEffect(() => {
        const focusChanged = wasFocused.current !== isFocused;
        wasFocused.current = isFocused;
        cancelAnimation(lyricsHeight);
        cancelAnimation(lyricsOpacity);
        cancelAnimation(textOpacity);

        const height = hasLyrics ? 46 : 0;
        const opacity = hasLyrics ? 1 : 0;
        const phraseOpacity = hasPhrase ? 1 : 0;
        // A covered screen can suspend native animations. Set the actual values on
        // focus changes so a suspended fade cannot leave the returning text hidden.
        if (!isFocused || focusChanged) {
            lyricsHeight.value = height;
            lyricsOpacity.value = opacity;
            textOpacity.value = phraseOpacity;
        } else {
            lyricsHeight.value = withTiming(height, { duration: 200 });
            lyricsOpacity.value = withTiming(opacity, { duration: 200 });
            textOpacity.value = withTiming(phraseOpacity, { duration: 150 });
        }
        return () => {
            cancelAnimation(lyricsHeight);
            cancelAnimation(lyricsOpacity);
            cancelAnimation(textOpacity);
        };
    }, [hasLyrics, hasPhrase, currentPhrase, isFocused, lyricsHeight, lyricsOpacity, textOpacity]);

    const lyricsAnimatedStyle = useAnimatedStyle(() => ({
        height: lyricsHeight.value,
        opacity: lyricsOpacity.value,
    }));
    const textAnimatedStyle = useAnimatedStyle(() => ({ opacity: textOpacity.value }));

    return {
        lyricsAnimatedStyle,
        textAnimatedStyle,
        // Keep one source of truth. No animation callback can erase a newer phrase.
        activeLyricText: hasLyrics ? currentPhrase : '',
    };
}
