import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';

interface Props {
  readonly error: boolean;
  readonly onRetry: () => void;
  readonly topOffset: number;
}

export function RankingLoadState({ error, onRetry, topOffset }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return <View style={{ paddingTop: topOffset, paddingHorizontal: 20 }}>
    {error && <TouchableOpacity onPress={onRetry}><Text style={{ color: colors.text }}>{t('album_ranking.load_error')}</Text></TouchableOpacity>}
  </View>;
}
