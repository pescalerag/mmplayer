import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';

interface ActivityHeaderProps {
  readonly isFromProfile: boolean;
  readonly onBack: () => void;
  readonly onHelp: () => void;
  readonly onHistory: () => void;
  readonly onShare: () => void;
  readonly shareButtonRef: React.RefObject<any>;
  readonly shareButtonLayout: React.RefObject<any>;
}

export function ActivityHeader({
  isFromProfile,
  onBack,
  onHelp,
  onHistory,
  onShare,
  shareButtonRef,
  shareButtonLayout,
}: ActivityHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();

  const handleShareLayout = (e: LayoutChangeEvent) => {
    if (e?.nativeEvent?.layout) {
      shareButtonLayout.current = e.nativeEvent.layout;
    }
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 12 }]}>
      {isFromProfile && (
        <TouchableOpacity
          onPress={onBack}
          style={[styles.backButton, { backgroundColor: 'rgba(255,255,255,0.06)' }]}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
      )}
      <Text style={[styles.headerTitle, { fontFamily: fonts.bold, color: colors.text }]}>
        {t('activity.title')}
      </Text>
      <View style={styles.headerRightActions}>
        <TouchableOpacity
          onPress={onHelp}
          style={styles.headerIconBtn}
          activeOpacity={0.7}
          accessibilityLabel={t('activity_tutorial.help_btn')}
        >
          <Ionicons name="help-circle-outline" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onHistory}
          style={styles.headerIconBtn}
          activeOpacity={0.7}
          accessibilityLabel={t('activity.history_title') || 'Historial'}
        >
          <Ionicons name="time-outline" size={20} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          ref={shareButtonRef}
          onLayout={handleShareLayout}
          onPress={onShare}
          style={styles.headerIconBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="share-social-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    letterSpacing: 1.2,
    fontWeight: '800',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
