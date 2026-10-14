import React, { useState } from 'react';
import { Switch, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAppTheme } from '../../hooks/useAppTheme';
import { useFilterChoices } from '../../hooks/useFilterChoices';
import { useLibraryStore } from '../../store/useLibraryStore';
import { openCustomDateModal } from '../../store/useCustomDateModalStore';
import { createSectionDraft, dateBoundary, EMPTY_SECTION_FILTERS, FilterSection, parseSectionDraft, SECTION_FIELDS, SectionFilterDraft, SectionFilters } from '../../utils/libraryFilters';
import { changeFilterBound, sliderRange } from '../../utils/filterSlider';
import { NumericFilterSlider } from './NumericFilterSlider';
import { FilterDisclosure } from './FilterDisclosure';

interface Props {
  section: FilterSection; onApply: (filters: SectionFilters) => void;
  draft?: SectionFilterDraft; setDraft?: React.Dispatch<React.SetStateAction<SectionFilterDraft>>; hideActions?: boolean;
}
export function LibraryFilterControls({ section, onApply, draft: controlled, setDraft: update, hideActions = false }: Props) {
  const { colors, fonts } = useAppTheme();
  const { t } = useTranslation();
  const [local, setLocal] = useState(() => createSectionDraft(useLibraryStore.getState().sectionFilters[section]));
  const draft = controlled ?? local, setDraft = update ?? setLocal;
  const [error, setError] = useState(false);
  const fields = SECTION_FIELDS[section];
  const options = useFilterChoices(fields.includes('genre') || fields.includes('formats'));
  const change = (key: keyof SectionFilters, value: string | boolean) => { setDraft(previous => ({ ...previous, [key]: value })); setError(false); };
  const chip = (label: string, selected: boolean, onPress: () => void) => <TouchableOpacity key={label} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label} onPress={onPress}
    style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 20, backgroundColor: selected ? colors.accent : colors.cardBackground }}>
    <Text style={{ color: selected ? colors.onAccent : colors.text, fontFamily: fonts.regular }}>{label}</Text>
  </TouchableOpacity>;
  const slider = (key: keyof SectionFilters) => {
    const range = sliderRange(key, section);
    return <NumericFilterSlider key={key} label={t(`library_filters.${key}`)} value={draft[key] === '' ? null : Number(String(draft[key]).replace(',', '.'))}
      minimum={range.min} maximum={range.max} step={range.step} expandable={!key.endsWith('Rating')}
      onChange={value => { setDraft(previous => changeFilterBound(previous, key, value)); setError(false); }} />;
  };
  const dates = (prefix: 'played' | 'created') => {
    const from = `${prefix}From` as keyof SectionFilters, to = `${prefix}To` as keyof SectionFilters;
    const start = String(draft[from]), end = String(draft[to]);
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const date = (value: string) => value ? new Date(dateBoundary(value)!) : null;
    return <View style={{ gap: 12 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel={t('filter_controls.choose_dates')} onPress={() => openCustomDateModal({
        restrictToHistory: false, initialStartDate: date(start), initialEndDate: date(end),
        onApply: (fromDate, toDate) => setDraft(previous => ({ ...previous, [from]: iso(fromDate), [to]: iso(toDate) })),
      })} style={{ padding: 14, borderRadius: 10, backgroundColor: colors.cardBackground }}>
        <Text style={{ color: colors.text, fontFamily: fonts.regular }}>{start || end ? `${start || '…'} – ${end || '…'}` : t('filter_controls.choose_dates')}</Text>
      </TouchableOpacity>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {!!start && chip(`${t(`library_filters.${from}`)} ×`, false, () => change(from, ''))}
        {!!end && chip(`${t(`library_filters.${to}`)} ×`, false, () => change(to, ''))}
      </View>
    </View>;
  };
  const numericGroups = ['Tracks', 'Albums', 'Duration', 'Rating', 'Size'].filter(suffix => fields.includes(`min${suffix}` as keyof SectionFilters));
  return <View>
    {fields.filter(key => ['favorite', 'lyrics', 'image', 'customCover'].includes(key)).map(key => <View key={key} style={{ gap: 8, paddingVertical: 12 }}>
      <Text style={{ color: colors.text, fontFamily: fonts.bold }}>{t(`library_filters.${key}`)}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{['any', 'yes', 'no'].map(value => chip(t(`library_filters.${value}`), draft[key] === value, () => change(key, value)))}</View>
    </View>)}
    {numericGroups.map(suffix => {
      const min = `min${suffix}` as keyof SectionFilters, max = `max${suffix}` as keyof SectionFilters;
      const active = draft[min] !== '' || draft[max] !== '';
      return <FilterDisclosure key={suffix} title={t(`filter_controls.${suffix.toLowerCase()}`)} active={active}
        summary={active ? `${draft[min] || '…'} – ${draft[max] || '…'}` : t('album_filters.unlimited')}>
        {slider(min)}{slider(max)}
      </FilterDisclosure>;
    })}
    {fields.includes('minPlays') && <FilterDisclosure title={t('filter_controls.listening')} active={draft.minPlays !== '' || draft.maxPlays !== '' || draft.playedFrom !== '' || draft.playedTo !== ''}>
      {slider('minPlays')}{slider('maxPlays')}{dates('played')}
    </FilterDisclosure>}
    {fields.includes('createdFrom') && <FilterDisclosure title={t('filter_controls.created')} active={draft.createdFrom !== '' || draft.createdTo !== ''}>
      {dates('created')}
    </FilterDisclosure>}
    {fields.filter(key => key === 'genre' || key === 'formats').map(key => {
      const selected = String(draft[key]);
      const choices = key === 'genre' ? [...new Set([...options.genres, ...(selected ? [selected] : [])])] : [...new Set([...options.formats, ...selected.split(',').map(value => value.trim()).filter(Boolean)])];
      return <FilterDisclosure key={key} title={t(`filter_controls.${key}`)} active={!!selected} summary={selected || t('library_filters.any')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {chip(t('library_filters.any'), !selected, () => change(key, ''))}
          {choices.map(value => {
            const list = selected.split(',').map(item => item.trim()).filter(Boolean);
            const active = key === 'genre' ? selected === value : list.includes(value);
            return chip(key === 'formats' ? value.toUpperCase() : value, active, () => change(key, key === 'genre' ? (active ? '' : value) : (active ? list.filter(item => item !== value) : [...list, value]).join(', ')));
          })}
        </View>
        {options.error && <TouchableOpacity onPress={options.retry}><Text style={{ color: colors.accent }}>{t('library_filters.load_error')}</Text></TouchableOpacity>}
      </FilterDisclosure>;
    })}
    {fields.includes('neverPlayed') && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 }}>
      <Text style={{ flex: 1, color: colors.text, fontFamily: fonts.regular }}>{t('library_filters.neverPlayed')}</Text>
      <Switch value={draft.neverPlayed === true} onValueChange={value => change('neverPlayed', value)} accessibilityLabel={t('library_filters.neverPlayed')} trackColor={{ false: colors.cardBackground, true: colors.accent }} />
    </View>}
    {error && <Text accessibilityRole="alert" style={{ color: colors.accent }}>{t('library_filters.invalid')}</Text>}
    {!hideActions && <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 12 }}>
      <TouchableOpacity style={{ flex: 1, padding: 14, alignItems: 'center' }} onPress={() => { setDraft(createSectionDraft(EMPTY_SECTION_FILTERS)); setError(false); }}><Text style={{ color: colors.text }}>{t('album_filters.reset')}</Text></TouchableOpacity>
      <TouchableOpacity style={{ flex: 1, padding: 14, alignItems: 'center', backgroundColor: colors.accent, borderRadius: 10 }} onPress={() => {
        const filters = parseSectionDraft(section, draft); if (!filters) { setError(true); return; } onApply(filters);
      }}><Text style={{ color: colors.onAccent }}>{t('album_filters.apply')}</Text></TouchableOpacity>
    </View>}
  </View>;
}
