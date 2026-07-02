import React, { useState, useMemo } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from "@/hooks/useAppTheme";
import { usePlayerStore } from '../store/usePlayerStore';
import { LyricsService } from '../services/LyricsService';

interface LRCLine {
    tag: string;
    text: string;
    isHeader: boolean;
}

const parseLRCToEditable = (lrc: string): LRCLine[] => {
    if (!lrc) return [];
    const lines = lrc.split(/\r?\n/);
    const timeRegex = /^(\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\])(.*)$/;

    return lines.map(line => {
        const match = line.match(timeRegex);
        if (match) {
            return {
                tag: match[1],
                text: match[5],
                isHeader: false
            };
        } else {
            // Check if it's metadata like [ar: ...]
            if (line.trim().startsWith('[') && !line.match(/\[\d{2}:\d{2}/)) {
                return {
                    tag: line,
                    text: '',
                    isHeader: true
                };
            }
            return {
                tag: '',
                text: line,
                isHeader: false
            };
        }
    });
};

const saveEditableToLRC = (editedText: string, originalLines: LRCLine[]): string => {
    const editedLines = editedText.split(/\r?\n/);
    const resultLines: string[] = [];

    // 1. Put all headers at the top
    originalLines.forEach(line => {
        if (line.isHeader) {
            resultLines.push(line.tag);
        }
    });

    // 2. Map edited lines to original timestamps
    const originalTimeLines = originalLines.filter(line => !line.isHeader);

    editedLines.forEach((editedLine, index) => {
        if (index < originalTimeLines.length) {
            const originalLine = originalTimeLines[index];
            if (originalLine.tag) {
                resultLines.push(`${originalLine.tag}${editedLine}`);
            } else {
                resultLines.push(editedLine);
            }
        } else {
            resultLines.push(editedLine);
        }
    });

    return resultLines.join('\n');
};

export default function LyricsEditorScreen() {
    const { colors, fonts, fontWeights, spacing } = useAppTheme();
    const insets = useSafeAreaInsets();
    const navigation = useNavigation();
    const { t } = useTranslation();

    const activeTrack = usePlayerStore(state => state.activeTrack);

    const originalLrcText = activeTrack?.lyricsLRC || '';
    const parsedOriginalLines = useMemo(() => parseLRCToEditable(originalLrcText), [originalLrcText]);

    // Construct the text input value (text only, omitting headers)
    const initialTextValue = useMemo(() => {
        return parsedOriginalLines
            .filter(line => !line.isHeader)
            .map(line => line.text)
            .join('\n');
    }, [parsedOriginalLines]);

    const [editedText, setEditedText] = useState(initialTextValue);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const handleTextChange = (text: string) => {
        setEditedText(text);
        setHasUnsavedChanges(true);
    };

    const handleSave = async () => {
        if (!activeTrack) return;
        try {
            const finalLrc = saveEditableToLRC(editedText, parsedOriginalLines);
            await LyricsService.saveLyrics(activeTrack, finalLrc);
            setHasUnsavedChanges(false);
            Alert.alert(t('actions.success') || 'Éxito', t('lyrics.save_success') || 'Letra guardada con éxito.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (e) {
            console.error('Error saving edited lyrics:', e);
            Alert.alert(t('actions.error') || 'Error', 'No se pudieron guardar los cambios.');
        }
    };

    const handleBack = () => {
        if (hasUnsavedChanges) {
            Alert.alert(
                t('actions.warning') || 'Atención',
                t('lyrics.unsaved_warning') || 'Tienes cambios sin guardar. ¿Deseas salir de todas formas?',
                [
                    { text: t('actions.cancel') || 'Cancelar', style: 'cancel' },
                    { text: t('actions.discard') || 'Descartar', style: 'destructive', onPress: () => navigation.goBack() }
                ]
            );
        } else {
            navigation.goBack();
        }
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: colors.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.overlayAlpha10 }]}>
                <TouchableOpacity onPress={handleBack} style={styles.headerBtn}>
                    <Ionicons name="chevron-back" size={24} color={colors.accent} />
                </TouchableOpacity>
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
