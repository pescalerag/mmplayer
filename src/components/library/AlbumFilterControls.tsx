import React, { useState } from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useLibraryStore } from '../../store/useLibraryStore';
import { AlbumFilters, AlbumFilterDraft, NumericAlbumFilter, EMPTY_ALBUM_FILTERS, createAlbumFilterDraft, parseAlbumFilterDraft } from '../../utils/albumFilters';
import { changeFilterBound, sliderRange } from '../../utils/filterSlider';
import { NumericFilterSlider } from './NumericFilterSlider';
import { FilterDisclosure } from './FilterDisclosure';

interface Props {
  onApply: (filters: AlbumFilters) => void;
  draft?: AlbumFilterDraft;
  setDraft?: React.Dispatch<React.SetStateAction<AlbumFilterDraft>>;
  hideActions?: boolean;
}
export function AlbumFilterControls({ onApply, draft: controlled, setDraft: update, hideActions = false }: Props) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  const [local, setLocal] = useState(() => createAlbumFilterDraft(useLibraryStore.getState().albumFilters));
  const draft = controlled ?? local, setDraft = update ?? setLocal;
  const [error, setError] = useState(false);
  const slider = (key: NumericAlbumFilter) => {
    const range = sliderRange(key);
    return <NumericFilterSlider key={key} label={t(`album_filters.${key}`)} value={draft[key] === '' ? null : Number(draft[key].replace(',', '.'))}
      minimum={range.min} maximum={range.max} step={range.step} expandable={!key.endsWith('Rating')} expandEarlier={key.endsWith('Year')}
      onChange={value => { setDraft(previous => changeFilterBound(previous, key, value)); setError(false); }} />;
  };
  const range = (suffix: 'Tracks' | 'Year' | 'Duration') => {
    const min = `min${suffix}` as NumericAlbumFilter, max = `max${suffix}` as NumericAlbumFilter;
    const active = draft[min] !== '' || draft[max] !== '';
    return <FilterDisclosure key={suffix} title={t(`filter_controls.${suffix.toLowerCase()}`)} active={active}
      summary={active ? `${draft[min] || '…'} – ${draft[max] || '…'}` : t('album_filters.unlimited')}>
      {slider(min)}{slider(max)}
    </FilterDisclosure>;
  };
  return <View>
    {range('Tracks')}{range('Year')}{range('Duration')}
    <FilterDisclosure title={t('filter_controls.rating')} active={draft.minRating !== ''} summary={draft.minRating || t('album_filters.unlimited')}>
      {slider('minRating')}
      <Text style={{ color: colors.textSecondary, fontFamily: fonts.regular }}>{t('album_filters.rating_hint')}</Text>
    </FilterDisclosure>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12 }}>
      <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.regular }}>{t('album_filters.withoutCover')}</Text>
      <Switch value={draft.withoutCover} accessibilityLabel={t('album_filters.withoutCover')} onValueChange={withoutCover => setDraft(previous => ({ ...previous, withoutCover }))} trackColor={{ false: colors.cardBackground, true: colors.accent }} />
    </View>
    {error && <Text accessibilityRole="alert" style={{ color: colors.accent }}>{t('album_filters.invalid')}</Text>}
    {!hideActions && <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 12 }}>
      <TouchableOpacity style={{ flex: 1, padding: 14, alignItems: 'center' }} onPress={() => { setDraft(createAlbumFilterDraft(EMPTY_ALBUM_FILTERS)); setError(false); }}><Text style={{ color: colors.text }}>{t('album_filters.reset')}</Text></TouchableOpacity>
      <TouchableOpacity style={{ flex: 1, padding: 14, alignItems: 'center', backgroundColor: colors.accent, borderRadius: 10 }} onPress={() => {
        const filters = parseAlbumFilterDraft(draft);
        if (!filters) { setError(true); return; } onApply(filters);
      }}><Text style={{ color: colors.onAccent }}>{t('album_filters.apply')}</Text></TouchableOpacity>
    </View>}
  </View>;
}
