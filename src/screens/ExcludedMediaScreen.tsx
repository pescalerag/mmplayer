import { useAppTheme } from "@/hooks/useAppTheme";
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScannerService } from '../services/ScannerService';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSyncStore } from '../store/useSyncStore';
import { Layout } from '../theme/theme';
import { getSafeFileName } from '../utils/safeDecode';

export default function ExcludedMediaScreen() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { type } = route.params || { type: 'folders' };
    const isFolders = type === 'folders';

    const [headerHeight, setHeaderHeight] = useState(100);
    const { excludedFolders, includeFolder, excludedSongs, includeSong } = useSettingsStore();
    const isScanning = useSyncStore(state => state.isScanning);
    const { t } = useTranslation();

    const items = isFolders ? (excludedFolders || []) : (excludedSongs || []);

    const handleRestore = async (itemPath: string) => {
        if (isFolders) {
            includeFolder(itemPath);
        } else {
            includeSong(itemPath);
        }
        await ScannerService.syncLibrary();
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>

            {/* CAPA DEL HUMO (INTERMEDIO) */}
            <LinearGradient
                colors={['#000000', 'rgba(0, 0, 0, 0.9)', 'rgba(0, 0, 0, 0.7)', 'transparent']}
                locations={[0, 0.4, 0.7, 1]}
                style={[styles.smokeEffect, { height: headerHeight + 30 }]}
                pointerEvents="none"
            />

            {/* CAPA DE ILUMINACIÓN MORADA */}
            <LinearGradient
                colors={[colors.accentAlpha20, "transparent"]}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 200, zIndex: 2 }}
                pointerEvents="none"
            />

            {/* CAPA DE LA INTERFAZ (FRENTE) */}
            <View
                onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
                style={styles.headerContainer}
            >
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={28} color={colors.accent} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle} numberOfLines={1}>
                        {isFolders ? t('settings.excluded_folders') : t('settings.excluded_songs')}
                    </Text>
                </View>
            </View>

            {/* CAPA DE CONTENIDO */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={[
                    styles.scrollContent,
                    {
                        paddingTop: headerHeight + 20,
                        paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom
                    }
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={styles.sectionCard}>
                    {items.length === 0 ? (
                        <Text style={styles.noExcludedText}>
                            {isFolders ? t('settings.no_excluded_folders') : t('settings.no_excluded_songs')}
                        </Text>
                    ) : (
                        items.map((itemPath) => {
                            const itemName = getSafeFileName(itemPath);
                            return (
                                <View key={itemPath} style={styles.excludedRow}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={styles.itemNameText} numberOfLines={1}>{itemName}</Text>
                                        <Text style={styles.itemPathText} numberOfLines={1}>{itemPath}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.restoreButton}
                                        disabled={isScanning}
                                        onPress={() => handleRestore(itemPath)}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="refresh-outline" size={16} color={colors.accent} />
                                        <Text style={styles.restoreButtonText}>
                                            {isScanning ? t('settings.syncing') : t('settings.restore')}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingHorizontal: 20,
    },
    headerContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingTop: 50,
        paddingHorizontal: 20,
        zIndex: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 24,
    },
    backBtn: {
        padding: 4,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 24,
        fontFamily: fonts.regular,
        fontWeight: '900',
        color: colors.text,
        flex: 1,
    },
    sectionCard: {
        backgroundColor: colors.overlayAlpha05,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    smokeEffect: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1,
    },
    noExcludedText: {
        color: '#888888',
        fontStyle: 'italic',
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '600',
        textAlign: 'center',
        paddingVertical: 20,
    },
    excludedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.overlayAlpha05,
    },
    itemNameText: {
        color: colors.text,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
    itemPathText: {
        color: colors.textSecondary,
        fontSize: 11,
        fontFamily: fonts.regular,
        fontWeight: '600',
        marginTop: 2,
    },
    restoreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.accentAlpha10,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 15,
        gap: 4,
    },
    restoreButtonText: {
        color: colors.accent,
        fontSize: 12,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
});
