import React from 'react';
import { StyleSheet, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';

export function DiscMask({ size, holeSize, children }: React.PropsWithChildren<{ size: number; holeSize: number }>) {
    return <MaskedView style={StyleSheet.absoluteFillObject} androidRenderingMode="hardware" maskElement={
        <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: (size - holeSize) / 2, borderColor: '#000', backgroundColor: 'transparent' }} />
    }>{children}</MaskedView>;
}
