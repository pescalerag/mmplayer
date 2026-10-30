import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '@/hooks/useAppTheme';
import { SectionHeader as SharedSectionHeader, SectionHeaderProps } from '../../../packages/ui/src/SectionHeader';

export default function SectionHeader(props: Readonly<SectionHeaderProps>) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  return <SharedSectionHeader {...props} seeAllLabel={t('activity.see_all')}
    theme={{ text: colors.text, accent: colors.accent, fontFamily: fonts.regular }} />;
}
