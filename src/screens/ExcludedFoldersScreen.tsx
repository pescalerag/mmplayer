import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore } from '../store/useSettingsStore';
import { ScannerService } from '../services/ScannerService';
import { useSyncStore } from '../store/useSyncStore';
import { Colors, Layout } from '../theme/theme';
import { useTranslation } from 'react-i18next';
import { getSafeFileName } from '../utils/safeDecode';
import { useAppTheme } from "@/hooks/useAppTheme";

export default function ExcludedFoldersScreen() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const [headerHeight, setHeaderHeight] = useState(100);
    const { excludedFolders, includeFolder } = useSettingsStore();
    const isScanning = useSyncStore(state => state.isScanning);
    const { t } = useTranslation();

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
                    <Text style={styles.headerTitle} numberOfLines={1}>{t('settings.excluded_folders')}</Text>
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
            >
                <View style={styles.sectionCard}>
                    {excludedFolders.length === 0 ? (
                        <Text style={styles.noExcludedText}>{t('settings.no_excluded_folders')}</Text>
                    ) : (
                        excludedFolders.map((folderPath) => {
                            const folderName = getSafeFileName(folderPath);
                            return (
                                <View key={folderPath} style={styles.excludedFolderRow}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={styles.folderNameText} numberOfLines={1}>{folderName}</Text>
                                        <Text style={styles.folderPathText} numberOfLines={1}>{folderPath}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.restoreButton}
                                        disabled={isScanning}
                                        onPress={async () => {
                                            includeFolder(folderPath);
                                            await ScannerService.syncLibrary();
                                        }}
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
    excludedFolderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: colors.overlayAlpha05,
    },
    folderNameText: {
        color: colors.text,
        fontSize: 14,
        fontFamily: fonts.regular,
        fontWeight: '700',
    },
    folderPathText: {
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
