import React, { useCallback } from 'react';
import { View } from 'react-native';

// Desktop retains its decoded images and artwork while the panel is resized.
export function ArtworkFadeIn({ size, children }: Readonly<{
    size: number;
    hasImage: boolean;
    children: (onReady: () => void) => React.ReactNode;
}>) {
    const onReady = useCallback(() => {}, []);
    return <View testID="player-styled-artwork" style={{ width: size, height: size }}>{children(onReady)}</View>;
}
