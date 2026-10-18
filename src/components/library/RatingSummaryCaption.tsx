import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { RatingSummary } from '../../utils/trackRatings';

export function RatingSummaryCaption({ rating, align = 'center' }: Readonly<{ rating?: RatingSummary; align?: 'center' | 'left' }>) {
  const { t, i18n } = useTranslation();
  const { colors, fonts } = useAppTheme();
  if (!rating) return null;
  const score = rating.average === null ? t('album_ranking.unrated') : `★ ${rating.average.toLocaleString(i18n.language, { maximumFractionDigits: 2 })} / 5`;
  return <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start', width: '100%', marginTop: 4 }}>
    <Text style={{ color: colors.text, fontFamily: fonts.regular, fontSize: align === 'center' ? 11 : 13, textAlign: align }}>{score}</Text>
    <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular, fontSize: align === 'center' ? 10 : 11, textAlign: align }}>
      {t('album_ranking.rated_count', { rated: rating.ratedCount, total: rating.totalCount })}
    </Text>
  </View>;
}
