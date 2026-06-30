import Constants from 'expo-constants';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SectionHeader from '../components/SectionHeader';
import { changelogs } from '../constants/changelogs';
import { Colors, Layout } from '../theme/theme';

export default function ChangelogScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const currentVersion = Constants.expoConfig?.version || '1.0.0';

  const versionKeys = Object.keys(changelogs).sort((a, b) => {
    const cleanA = a.replace(/-beta$/, '');
    const cleanB = b.replace(/-beta$/, '');
    if (cleanA !== cleanB) {
      return cleanB.localeCompare(cleanA, undefined, { numeric: true });
    }
    return a.endsWith('-beta') ? 1 : -1;
  });

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      contentContainerStyle={{ paddingBottom: Layout.MINI_PLAYER_HEIGHT + Layout.TAB_BAR_HEIGHT + Layout.PLAYER_MARGIN + insets.bottom + 30 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.headerTitle}>{t('changelog.history_title')}</Text>
      <Text style={styles.headerSubtitle}>{t('changelog.history_subtitle')}</Text>

      {versionKeys.map((version) => {
        const data = changelogs[version];
        const isCurrent = version === currentVersion;

        return (
          <View key={version} style={styles.versionBlock}>
            <View style={styles.versionHeaderRow}>
              <SectionHeader title={t('changelog.version_label', { version })} />
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <Text style={styles.currentBadgeText}>{t('changelog.current_badge')}</Text>
                </View>
              )}
            </View>

            <Text style={versionDateStyle(isCurrent)}>{data.date} — {data.title}</Text>

            <View style={[styles.card, isCurrent && styles.cardCurrent]}>
              {data.changes.map((change, index) => (
                <Text key={index} style={styles.changeItem}>{change}</Text>
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const versionDateStyle = (isCurrent: boolean) => [
  styles.versionDate,
  isCurrent && { color: '#8B5CF6' } // highlight current version date if helpful, or keep standard style
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerTitle: { fontSize: 28, fontFamily: 'Montserrat', fontWeight: '900', color: '#FFF', paddingHorizontal: 20, marginTop: 20 },
  headerSubtitle: { fontSize: 14, fontFamily: 'Montserrat', fontWeight: '500', color: '#888', paddingHorizontal: 20, marginTop: 4, marginBottom: 10 },
  versionBlock: { marginTop: 24 },
  versionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 20 },
  versionDate: { color: '#666', fontSize: 12, fontFamily: 'Montserrat', fontWeight: '700', paddingHorizontal: 20, marginTop: -4, marginBottom: 12 },
  currentBadge: { backgroundColor: 'rgba(139, 92, 246, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(139, 92, 246, 0.4)' },
  currentBadgeText: { color: '#A78BFA', fontSize: 11, fontFamily: 'Montserrat', fontWeight: '800' },
  card: { backgroundColor: '#121212', marginHorizontal: 20, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  cardCurrent: { borderColor: 'rgba(139, 92, 246, 0.3)', backgroundColor: '#15111C' },
  changeItem: { color: '#E0E0E0', fontSize: 14, fontFamily: 'Montserrat', fontWeight: '500', marginBottom: 12, lineHeight: 22 },
});
