import React from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { RankedAlbum } from '../../utils/albumRanking';

export function AlbumRatingCaption({ rating }: Readonly<{ rating?: RankedAlbum }>) {
  const { t, i18n } = useTranslation();
  const { colors, fonts } = useAppTheme();
  if (!rating) return null;
  const score = rating.average === null ? t('album_ranking.unrated') : `★ ${rating.average.toLocaleString(i18n.language, { maximumFractionDigits: 2 })} / 5`;
  return <View style={{ alignItems: 'center', width: '100%', marginTop: 2 }}>
    <Text style={{ color: colors.text, fontFamily: fonts.regular, fontSize: 11, textAlign: 'center' }}>{score}</Text>
    <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular, fontSize: 10, textAlign: 'center' }}>
      {t('album_ranking.rated_count', { rated: rating.ratedCount, total: rating.totalCount })}
    </Text>
  </View>;
}
