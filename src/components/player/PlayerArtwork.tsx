import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

interface PlayerArtworkProps {
    coverUrl?: string | null;
    size: number;
    borderRadius?: number;
    shadowStyle?: any;
    cardBackgroundColor: string;
    textSecondaryColor: string;
}

export const PlayerArtwork = ({
    coverUrl,
    size,
    borderRadius = 10,
    shadowStyle,
    cardBackgroundColor,
    textSecondaryColor,
}: PlayerArtworkProps) => {
    const [failedRequest, setFailedRequest] = useState<string | null>(null);
    const failedRequestRef = useRef<string | null>(null);
    failedRequestRef.current = failedRequest;
    const [imageAttempt, setImageAttempt] = useState(0);
    const isFocused = useIsFocused();
    const imageRef = useRef<Image | null>(null);
    const imageRequestRef = useRef<string | null>(null);
    const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

    // Mirror BlurredBackground: keep lastValidUriRef so null intermediates
    // (during track change while observable resolves) never flash a placeholder.
    const lastValidUriRef = useRef<string | null>(coverUrl || null);

    useEffect(() => {
        if (coverUrl) {
            lastValidUriRef.current = coverUrl;
        } else {
            // If coverUrl stays null (genuine no-cover track), clear previous image after short grace period
            const timer = setTimeout(() => {
                lastValidUriRef.current = null;
                forceUpdate();
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [coverUrl]);

    if (coverUrl) {
        lastValidUriRef.current = coverUrl;
    }
    const effectiveUri = coverUrl || lastValidUriRef.current;
    const requestKey = `${effectiveUri}:${imageAttempt}`;
    imageRequestRef.current = requestKey;
    const showPlaceholder = !effectiveUri || failedRequest === requestKey;

    useEffect(() => {
        setFailedRequest(null);
        setImageAttempt(0);
    }, [effectiveUri]);

    useEffect(() => {
        // Returning to PlayerScreen must keep a successfully decoded cover intact.
        // Retry only an image that actually failed, without recreating its native view.
        const retryFailedImage = () => {
            if (!failedRequestRef.current) return;
            setFailedRequest(null);
            setImageAttempt(0);
            void imageRef.current?.reloadAsync().catch(() => {});
        };
        if (isFocused) retryFailedImage();
        const subscription = AppState.addEventListener('change', state => {
            if (state === 'active' && isFocused) retryFailedImage();
        });
        return () => subscription.remove();
    }, [isFocused]);

    const imageSource = useMemo(
        () => (effectiveUri ? { uri: effectiveUri } : null),
        [effectiveUri]
    );

    return (
        <View
            style={[
                {
                    width: size,
                    height: size,
                    borderRadius,
                    overflow: 'hidden',
                    backgroundColor: cardBackgroundColor,
                },
                shadowStyle,
            ]}
        >
            {showPlaceholder ? (
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: cardBackgroundColor }]}>
                    <Ionicons
                        name="musical-notes"
                        size={Math.min(80, Math.floor(size * 0.25))}
                        color={textSecondaryColor}
                    />
                </View>
            ) : (
                <Image
                    ref={imageRef}
                    source={imageSource}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    transition={0}
                    cachePolicy="memory-disk"
                    onError={() => {
                        // An error from the previous cover must not hide the current one.
                        if (imageRequestRef.current !== requestKey) return;
                        if (imageAttempt === 0) {
                            setImageAttempt(1);
                            void imageRef.current?.reloadAsync().catch(() => {});
                        }
                        else setFailedRequest(requestKey);
                    }}
                />
            )}
        </View>
    );
};
PlayerArtwork.displayName = 'PlayerArtwork';
