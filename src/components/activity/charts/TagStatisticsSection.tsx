import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../../hooks/useAppTheme';
import { TagHistoryScope } from '../../../database/models/PlaybackHistoryTag';
import { EntityStatisticsSection } from './EntityStatisticsSection';

const SCOPES: TagHistoryScope[] = ['track', 'album'];

export function TagStatisticsSection({ tagId }: { readonly tagId: string }) {
  const [scope, setScope] = useState<TagHistoryScope>('track');
  const { colors, fonts, radii } = useAppTheme();
  const { t } = useTranslation();
  return (
    <EntityStatisticsSection tagFilter={{ tagId, scope }}>
      <View style={styles.tabs}>
        {SCOPES.map(value => (
          <TouchableOpacity key={value} accessibilityRole="tab" accessibilityState={{ selected: scope === value }} onPress={() => setScope(value)} style={[styles.tab, { borderRadius: radii.md, backgroundColor: scope === value ? colors.accent : colors.overlayAlpha05 }]}>
            <Text style={{ fontFamily: fonts.bold, color: scope === value ? colors.onAccent : colors.textSecondary }}>{t(`activity.charts.tag_scopes.${value}`)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('activity.charts.tag_history_notice')}</Text>
      {scope === 'album' && <Text style={[styles.hint, { color: colors.textSecondary, fontFamily: fonts.regular }]}>{t('activity.charts.tag_album_notice')}</Text>}
    </EntityStatisticsSection>
  );
}

const styles = StyleSheet.create({ tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16 }, tab: { flex: 1, alignItems: 'center', padding: 10 }, hint: { paddingHorizontal: 20, paddingTop: 12, fontSize: 12, lineHeight: 18 } });
