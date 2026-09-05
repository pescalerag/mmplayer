import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/hooks/useAppTheme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useUIStore } from '@/store/useUIStore';
import { useToastStore } from '@/store/useToastStore';

export default function EditAliasSheet() {
  const { colors, fonts, fontWeights, radii } = useAppTheme();
  const { t } = useTranslation();
  const userAlias = useSettingsStore((state) => state.userAlias);
  const setUserAlias = useSettingsStore((state) => state.setUserAlias);
  const closeSheet = useUIStore((state) => state.closeSheet);
  const showToast = useToastStore((state) => state.showToast);

  const [aliasInput, setAliasInput] = useState(userAlias || '');

  useEffect(() => {
    setAliasInput(userAlias || '');
  }, [userAlias]);

  const handleSave = () => {
    const trimmed = aliasInput.trim();
    if (!trimmed) return;
    setUserAlias(trimmed);
    Keyboard.dismiss();
    closeSheet();
    showToast(
      t('profile.alias_updated') || 'Alias actualizado correctamente',
      'checkmark-circle'
    );
  };

  const styles = React.useMemo(
    () => getStyles(colors, fonts, fontWeights, radii),
    [colors, fonts, fontWeights, radii]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {t('profile.edit_alias_title') || 'Cambiar alias'}
        </Text>
        <Text style={styles.subtitle}>
          {t('profile.edit_alias_subtitle') || 'Elige el nombre con el que quieres identificarte'}
        </Text>
      </View>

      <View style={styles.inputContainer}>
        <Ionicons
          name="person-outline"
          size={20}
          color={colors.accent || '#8B5CF6'}
          style={styles.inputIcon}
        />
        <TextInput
          style={styles.input}
          placeholder={t('profile.alias_placeholder') || 'Tu nombre o alias...'}
          placeholderTextColor={colors.textSecondary || '#888888'}
          value={aliasInput}
          onChangeText={setAliasInput}
          maxLength={30}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
          autoCapitalize="words"
        />
        {aliasInput.length > 0 && (
          <TouchableOpacity
            onPress={() => setAliasInput('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.clearBtn}
          >
            <Ionicons
              name="close-circle"
              size={18}
              color={colors.textSecondary || '#888888'}
            />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.saveButton, !aliasInput.trim() && styles.saveButtonDisabled]}
        onPress={handleSave}
        activeOpacity={0.8}
        disabled={!aliasInput.trim()}
      >
        <Text style={styles.saveButtonText}>
          {t('profile.save_alias') || 'Guardar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = (colors: any, fonts: any, fontWeights: any, radii: any) =>
  StyleSheet.create({
    container: {
      width: '100%',
      paddingBottom: 20,
    },
    header: {
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255, 255, 255, 0.08)',
      marginBottom: 20,
    },
    title: {
      fontSize: 20,
      fontFamily: fonts?.regular || 'Montserrat',
      fontWeight: fontWeights?.bold || '800',
      color: colors?.text || '#FFFFFF',
    },
    subtitle: {
      fontSize: 13,
      fontFamily: fonts?.regular || 'Montserrat',
      fontWeight: '600',
      color: colors?.textSecondary || '#AAAAAA',
      marginTop: 4,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255, 255, 255, 0.06)',
      borderRadius: radii?.lg || 14,
      borderWidth: 1,
      borderColor: 'rgba(255, 255, 255, 0.12)',
      paddingHorizontal: 16,
      height: 52,
      marginBottom: 20,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      color: colors?.text || '#FFFFFF',
      fontSize: 16,
      fontFamily: fonts?.regular || 'Montserrat',
      fontWeight: '600',
      paddingVertical: 0,
    },
    clearBtn: {
      padding: 4,
    },
    saveButton: {
      width: '100%',
      height: 50,
      backgroundColor: colors?.accent || '#8B5CF6',
      borderRadius: radii?.lg || 14,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors?.accent || '#8B5CF6',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 4,
    },
    saveButtonDisabled: {
      opacity: 0.4,
    },
    saveButtonText: {
      color: colors?.onAccent || '#FFFFFF',
      fontSize: 15,
      fontFamily: fonts?.regular || 'Montserrat',
      fontWeight: '800',
      letterSpacing: 0.5,
    },
  });
