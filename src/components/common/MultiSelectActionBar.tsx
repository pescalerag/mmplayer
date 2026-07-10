import { openMetadataEditor, openPlaylistSelector, openBatchMenu } from '@/store/useUIStore';
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMultiSelectStore } from '../../store/useMultiSelectStore';

import { useAppTheme } from '@/hooks/useAppTheme';

export default function MultiSelectActionBar() {
    const { colors, fonts, fontWeights } = useAppTheme();
    const insets = useSafeAreaInsets();
    
    const { isSelectionMode, selectedTracks, exitSelectionMode } = useMultiSelectStore();
    
    const translateY = useRef(new Animated.Value(-150)).current;

    useEffect(() => {
        if (isSelectionMode) {
            Animated.spring(translateY, {
                toValue: 0,
                tension: 60,
                friction: 10,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(translateY, {
                toValue: -150,
                duration: 250,
                useNativeDriver: true,
            }).start();
        }
    }, [isSelectionMode]);

    if (!isSelectionMode) return null;

    const handleAddToPlaylist = () => {
        openPlaylistSelector(selectedTracks);
    };

    const handleOpenBatchMenu = () => {
        openBatchMenu(selectedTracks);
    };

    const handleEditMetadata = () => {
        openMetadataEditor(selectedTracks);
    };

    return (
        <Animated.View 
            style={[
                styles.container, 
                { 
                    backgroundColor: colors.cardBackground,
                    transform: [{ translateY }],
                    top: insets.top + 10
                }
            ]}
        >
            <View style={styles.infoRow}>
                <TouchableOpacity onPress={exitSelectionMode} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.countText, { color: colors.text, fontFamily: fonts.regular, fontWeight: fontWeights.bold }]}>
                    {selectedTracks.length} seleccionadas
                </Text>
            </View>

            <View style={styles.actionsRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.overlayAlpha05, borderColor: '#333', borderWidth: 1 }]} onPress={handleOpenBatchMenu}>
                    <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.overlayAlpha05, borderColor: '#333', borderWidth: 1 }]} onPress={handleEditMetadata}>
                    <Ionicons name="pencil" size={20} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.accent }]} onPress={handleAddToPlaylist}>
                    <Ionicons name="add" size={26} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 20,
        right: 20,
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#333',
        zIndex: 9999,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    closeBtn: {
        marginRight: 12,
        padding: 4,
    },
    countText: {
        fontSize: 16,
    },
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionBtn: {
        width: 44,
        height: 44,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 22,
    }
});
