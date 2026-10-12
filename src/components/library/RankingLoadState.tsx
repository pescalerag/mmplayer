import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';

interface Props {
  readonly showLoader: boolean;
  readonly error: boolean;
  readonly onRetry: () => void;
  readonly topOffset: number;
}

export function RankingLoadState({ showLoader, error, onRetry, topOffset }: Props) {
  const { t } = useTranslation();
  const { colors } = useAppTheme();
  return <View style={{ paddingTop: topOffset, paddingHorizontal: 20 }}>
    {showLoader && <ActivityIndicator color={colors.accent} />}
    {error && <TouchableOpacity onPress={onRetry}><Text style={{ color: colors.text }}>{t('album_ranking.load_error')}</Text></TouchableOpacity>}
  </View>;
}
