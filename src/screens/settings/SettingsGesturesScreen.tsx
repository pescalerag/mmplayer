import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SwipeAction, useSettingsStore } from '../../store/useSettingsStore';
import { openSwipeAction } from '@/store/useUIStore';
import { ScreenHeaderLayout } from '@/components/layouts/ScreenHeaderLayout';

export default function SettingsGesturesScreen() {
    const { t } = useTranslation();
    const { swipeLeftAction, swipeRightAction } = useSettingsStore();
    const openSheet = openSwipeAction;

    const swipeOptions: { label: string, value: SwipeAction, icon: any }[] = [
        { label: t('settings.swipe_action_add_next'), value: 'add_next', icon: 'return-down-forward' },
        { label: t('settings.swipe_action_add_last'), value: 'add_last', icon: 'list' },
        { label: t('actions.add_to_playlist'), value: 'add_to_playlist', icon: 'add-circle-outline' },
        { label: t('settings.swipe_action_toggle_favorite'), value: 'toggle_favorite', icon: 'heart' },
        { label: t('settings.swipe_action_none'), value: 'none', icon: 'close' },
    ];

    return (
        <ScreenHeaderLayout title={t('settings.swipe_actions') || 'Gestos'}>
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
                        <TouchableOpacity
                            style={styles.buttonRow}
                            onPress={() => {
                                openSheet('left');
                            }}
                        >
                            <View style={{ flex: 1, paddingRight: 15 }}>
                                <Text style={styles.settingLabel}>{t('settings.swipe_left')}</Text>
                                <Text style={styles.settingDescription}>
                                    {swipeOptions.find(o => o.value === swipeLeftAction)?.label}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                        </TouchableOpacity>
                        <View style={styles.separator} />
                        <TouchableOpacity
                            style={styles.buttonRow}
                            onPress={() => {
                                openSheet('right');
                            }}
                        >
                            <View style={{ flex: 1, paddingRight: 15 }}>
                                <Text style={styles.settingLabel}>{t('settings.swipe_right')}</Text>
                                <Text style={styles.settingDescription}>
                                    {swipeOptions.find(o => o.value === swipeRightAction)?.label}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#8B5CF6" />
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            )}
        </ScreenHeaderLayout>
    );
}

const styles = StyleSheet.create({
    scrollContent: {
        paddingHorizontal: 20,
    },
    sectionCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 20,
        marginBottom: 20,
    },
    settingLabel: {
        fontSize: 16,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#FFFFFF',
    },
    settingDescription: {
        fontSize: 12,
        fontFamily: 'Montserrat',
        fontWeight: '700',
        color: '#888',
        marginTop: 4,
        lineHeight: 16,
    },
    buttonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    separator: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        marginVertical: 4,
    },
});
