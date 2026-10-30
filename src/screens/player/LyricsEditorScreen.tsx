import { HeaderHistoryControls } from '../../components/layouts/HeaderHistoryControls';
import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    TextInput,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from "@/hooks/useAppTheme";
import { useLyricsDocument } from '../../hooks/useLyricsDocument';
import { useUnsavedDocument } from '../../hooks/useUnsavedDocument';
import { PlayerStackParamList } from '../../navigation/types';
import Track from '../../database/models/Track';
import { InvisibleScreenContent } from '../../components/layouts/InvisibleScreenContent';
import { LyricsService } from '../../services/LyricsService';

export default function LyricsEditorScreen() {
    const { trackId } = useRoute<RouteProp<PlayerStackParamList, 'LyricsEditor'>>().params;
    const { document, missing } = useLyricsDocument(trackId);
    const navigation = useNavigation();
    const { t } = useTranslation();
    if (!document) return <InvisibleScreenContent ready={missing}>{missing && <TouchableOpacity style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }} onPress={() => navigation.goBack()}><Text style={{ color: '#FFFFFF', textAlign: 'center' }}>{t('timestamps.load_error')}</Text></TouchableOpacity>}</InvisibleScreenContent>;
    return <LyricsEditorDocument key={trackId} track={document.track} initialText={document.text} />;
}

function LyricsEditorDocument({ track, initialText }: { track: Track; initialText: string }) {
    const { colors, fonts, fontWeights, spacing } = useAppTheme({ ignoreTheme: true });
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { t } = useTranslation();

    const [editedText, setEditedText] = useState(initialText);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useUnsavedDocument(hasUnsavedChanges);

    const handleTextChange = (text: string) => {
        setEditedText(text);
        setHasUnsavedChanges(true);
    };

    const handleSave = async () => {
        if (track._raw._status === 'deleted') return;
        try {
            await LyricsService.saveLyrics(track, editedText);
            setHasUnsavedChanges(false);
            Alert.alert(t('actions.success') || 'Éxito', t('lyrics.save_success') || 'Letra guardada con éxito.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (e) {
            console.error('Error saving edited lyrics:', e);
            Alert.alert(t('actions.error') || 'Error', t('lyrics.save_error') || 'No se pudieron guardar los cambios.');
        }
    };

    const handleBack = () => navigation.goBack();

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.overlayAlpha10 }]}>
                <HeaderHistoryControls><TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.accent} />
                </TouchableOpacity></HeaderHistoryControls>
                <Text style={[styles.headerTitle, { color: colors.text, fontFamily: fonts.regular, fontWeight: fontWeights.bold }]}>
                    {t('lyrics.edit_title') || 'Editar letras'}
                </Text>
                <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                    <Text style={[styles.saveText, { color: colors.accent, fontFamily: fonts.regular, fontWeight: fontWeights.bold }]}>
                        {t('actions.save') || 'Guardar'}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Input Box */}
            <ScrollView
                style={styles.editorScroll}
                contentContainerStyle={{ padding: spacing.md || 16, paddingBottom: insets.bottom + 40 }}
                keyboardShouldPersistTaps="handled"
            >
                <TextInput
                    multiline
                    value={editedText}
                    onChangeText={handleTextChange}
                    placeholder={t('lyrics.edit_placeholder') || 'Escribe las letras aquí...'}
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.textInput, {
                        color: colors.text,
                        fontFamily: fonts.regular,
                        lineHeight: 24,
                        fontSize: 16
                    }]}
                    autoCapitalize="sentences"
                    autoCorrect
                />
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
    },
    headerBtn: {
        padding: 6,
        minWidth: 60,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        textAlign: 'center',
    },
    saveText: {
        fontSize: 16,
        textAlign: 'right',
    },
    editorScroll: {
        flex: 1,
    },
    textInput: {
        textAlignVertical: 'top',
        minHeight: 400,
        padding: 4,
    }
});
