import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute } from '@react-navigation/native';
import { useAppTheme } from "@/hooks/useAppTheme";
import { ScannerService } from '../services/ScannerService';
import { useSettingsStore } from '../store/useSettingsStore';
import { useSyncStore } from '../store/useSyncStore';
import { getSafeFileName } from '../utils/safeDecode';
import { ScreenHeaderLayout } from '../components/ScreenHeaderLayout';

export default function ExcludedMediaScreen() {
    const { colors, fonts, layout } = useAppTheme();
    const styles = React.useMemo(() => getStyles(colors, fonts, layout), [colors, fonts, layout]);
    const route = useRoute<any>();
    const { type } = route.params || { type: 'folders' };
    const isFolders = type === 'folders';

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
        <ScreenHeaderLayout title={isFolders ? t('settings.excluded_folders') : t('settings.excluded_songs')}>
            {({ headerHeight, bottomPadding }) => (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={[
                        styles.scrollContent,
                        {
                            paddingTop: headerHeight + 20,
                            paddingBottom: bottomPadding
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
            )}
        </ScreenHeaderLayout>
    );
}

const getStyles = (colors: any, fonts: any, layout: any) => StyleSheet.create({
    scrollContent: {
        paddingHorizontal: 20,
    },
    sectionCard: {
        backgroundColor: colors.overlayAlpha05,
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
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
