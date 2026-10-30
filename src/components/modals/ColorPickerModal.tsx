import * as NavigationBar from 'expo-navigation-bar';
import { StatusBar } from 'expo-status-bar';
import { useColorPickerModalStore } from '../../store/useColorPickerModalStore';
import { useUIStore } from '../../store/useUIStore';
import { normalizeOpaqueColor } from '../../utils/customColors';
import React, { useEffect, useRef, useState } from 'react';
import { BackHandler, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ColorPicker, { HueSlider, Panel1, Swatches } from 'reanimated-color-picker';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { getDynamicTagTextColor } from '../../utils/color';

function ColorPickerContent({ initialColor, title, requestId }: Readonly<{ initialColor: string; title: string; requestId: number }>) {
    const { colors, fonts } = useAppTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [draftColor, setDraftColor] = useState(initialColor);
    const draftRef = useRef(initialColor);
    const onClose = useColorPickerModalStore(state => state.close);
    const selectColor = (result: { hex: string }) => {
        const color = normalizeOpaqueColor(result.hex);
        draftRef.current = color;
        setDraftColor(color);
    };

    return (
        <View style={[StyleSheet.absoluteFill, styles.root]} pointerEvents="auto">
            <StatusBar style="light" />
                <View style={[styles.backdrop, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('actions.cancel')} />
                    <View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.sheetBackground, borderColor: colors.border }]}>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
                            <Text style={{ color: colors.text, fontFamily: fonts.bold, fontSize: 18 }}>{title}</Text>
                            <View style={styles.preview}>
                                <View style={[styles.dot, { backgroundColor: draftColor }]} />
                                <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{draftColor.toUpperCase()}</Text>
                            </View>
                            <ColorPicker value={draftColor} style={{ width: '100%' }} onCompleteJS={selectColor}>
                                <Panel1 />
                                <HueSlider style={{ marginTop: 16 }} />
                                <Swatches style={{ marginTop: 16 }} />
                            </ColorPicker>
                            <View style={styles.buttons}>
                                <TouchableOpacity style={styles.button} onPress={onClose}>
                                    <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{t('actions.cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.button, { backgroundColor: draftColor }]} onPress={() => useColorPickerModalStore.getState().confirm(draftRef.current, requestId)}>
                                    <Text style={{ color: getDynamicTagTextColor(draftColor), fontFamily: fonts.bold }}>{t('tags.confirm_color')}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
        </View>
    );
}

export default function ColorPickerModal() {
    const request = useColorPickerModalStore(state => state.request);
    const close = useColorPickerModalStore(state => state.close);
    const { colors } = useAppTheme();
    useEffect(() => {
        if (!request) return;
        if (Platform.OS === 'android') {
            void NavigationBar.setBackgroundColorAsync('#00000000').catch(() => {});
            void NavigationBar.setButtonStyleAsync('light').catch(() => {});
        }
        const back = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
        return () => {
            back.remove();
            if (Platform.OS === 'android') {
                const background = useUIStore.getState().activeSheet ? colors.sheetBackground : '#00000000';
                void NavigationBar.setBackgroundColorAsync(background).catch(() => {});
            }
        };
    }, [request, close, colors.sheetBackground]);
    if (!request) return null;
    return <ColorPickerContent key={request.id} initialColor={request.initialColor} title={request.title} requestId={request.id} />;
}

const styles = StyleSheet.create({
    root: { zIndex: 999999, elevation: 999999 },
    backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, backgroundColor: '#00000099' },
    card: { width: '100%', maxWidth: 400, maxHeight: '100%', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
    content: { padding: 20, gap: 20 },
    preview: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    dot: { width: 28, height: 28, borderRadius: 14 },
    buttons: { flexDirection: 'row', gap: 12 },
    button: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
});
