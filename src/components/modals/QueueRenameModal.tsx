import React, { useEffect, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useMultipleQueuesStore } from '../../store/useMultipleQueuesStore';
import { useQueueRenameModalStore } from '../../store/useQueueRenameModalStore';

export default function QueueRenameModal() {
    const { queueId, close } = useQueueRenameModalStore();
    const { colors, fonts } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [name, setName] = useState('');
    useEffect(() => {
        if (queueId === null) return;
        setName(useMultipleQueuesStore.getState().slots[queueId].name);
        if (Platform.OS === 'android') {
            NavigationBar.setBackgroundColorAsync('#00000000').catch(() => {});
            NavigationBar.setButtonStyleAsync('light').catch(() => {});
        }
        const back = Platform.OS === 'web' ? undefined : BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
        return () => {
            back?.remove();
            if (Platform.OS === 'android') NavigationBar.setBackgroundColorAsync('#121212').catch(() => {});
        };
    }, [queueId, close]);
    if (queueId === null) return null;
    const save = () => { useMultipleQueuesStore.getState().rename(queueId, name); close(); };
    return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[StyleSheet.absoluteFill, { zIndex: 999999, elevation: 999999, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: '#00000099' }]}>
        <Pressable accessibilityLabel={t('actions.cancel')} onPress={close} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={{ padding: 20, borderRadius: 14, backgroundColor: colors.cardBackground, gap: 16 }}>
            <Text style={{ color: colors.text, fontFamily: fonts.bold }}>{t('queue.rename_title')}</Text>
            <TextInput autoFocus value={name} onChangeText={setName} maxLength={60} onSubmitEditing={save}
                placeholder={t('queue.slot_name', { number: queueId + 1 })} placeholderTextColor={colors.textSecondary}
                accessibilityLabel={t('queue.rename_title')} style={{ color: colors.text, fontFamily: fonts.regular, borderBottomWidth: 1, borderBottomColor: colors.accent, paddingVertical: 8 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 24 }}>
                <TouchableOpacity onPress={close}><Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{t('actions.cancel')}</Text></TouchableOpacity>
                <TouchableOpacity testID="queue-rename-save" accessibilityRole="button" onPress={save}><Text style={{ color: colors.accent, fontFamily: fonts.regular }}>{t('queue.rename_save')}</Text></TouchableOpacity>
            </View>
        </View>
    </KeyboardAvoidingView>;
}
