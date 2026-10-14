import React from 'react';
import { LibraryFilterControls } from '../components/library/LibraryFilterControls';
import { useLibraryStore } from '../store/useLibraryStore';
import { EMPTY_SECTION_FILTERS, FilterSection } from '../utils/libraryFilters';
import { NumericFilterSlider } from '../components/library/NumericFilterSlider';
import { useCustomDateModalStore } from '../store/useCustomDateModalStore';

jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../hooks/useFilterChoices', () => ({ useFilterChoices: () => ({ genres: ['Rock', 'Jazz'], formats: ['mp3', 'flac'], error: false, retry: jest.fn() }) }));

jest.mock('../hooks/useAppTheme', () => ({ useAppTheme: () => ({ colors: { text: '#fff', textSecondary: '#aaa', cardBackground: '#222', accent: '#f00', onAccent: '#fff' }, fonts: { regular: 'regular', bold: 'bold' } }) }));
jest.mock('react-native', () => ({ Text: 'Text', TextInput: 'TextInput', View: 'View', Switch: 'Switch', TouchableOpacity: 'Button', StyleSheet: { create: (styles: any) => styles } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const nodes = (tree: any): any[] => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];
describe('section filter forms', () => {
  let state: any[], cursor: number;
  const apply = jest.fn();
  const render = (section: FilterSection) => { cursor = 0; return nodes(LibraryFilterControls({ section, onApply: apply })); };
  const input = (section: FilterSection, key: string, value: number | null) => render(section).find(node => node.type === NumericFilterSlider && node.props.label === `library_filters.${key}`).props.onChange(value);
  const submit = (section: FilterSection) => render(section).filter(node => node.type === 'Button').at(-1).props.onPress();
  beforeEach(() => {
    state = []; cursor = 0; apply.mockClear();
    for (const section of ['tracks', 'artists', 'playlists', 'folders'] as const) useLibraryStore.getState().setSectionFilters(section, EMPTY_SECTION_FILTERS);
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [state[slot], (value: any) => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
    }) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('applies favorite choice, duration and never-played together only after confirmation', () => {
    render('tracks').find(node => node.props.accessibilityLabel === 'library_filters.yes').props.onPress();
    input('tracks', 'minDuration', 2.5);
    render('tracks').find(node => node.type === 'Switch').props.onValueChange(true);
    expect(apply).not.toHaveBeenCalled();
    submit('tracks');
    expect(apply).toHaveBeenCalledWith({ ...EMPTY_SECTION_FILTERS, favorite: 'yes', minDuration: 2.5, neverPlayed: true });
  });

  it.each(['artists', 'playlists', 'folders'] as const)('orders and clears numeric slider bounds in %s', section => {
    input(section, 'minTracks', 10); input(section, 'maxTracks', 5); submit(section);
    expect(apply).toHaveBeenLastCalledWith({ ...EMPTY_SECTION_FILTERS, minTracks: 5, maxTracks: 5 });
    render(section).filter(node => node.type === 'Button').at(-2).props.onPress();
    submit(section);
    expect(apply).toHaveBeenCalledWith(EMPTY_SECTION_FILTERS);
  });

  it('selects genres and formats without entering text', () => {
    render('tracks').find(node => node.props.accessibilityLabel === 'Jazz').props.onPress();
    render('tracks').find(node => node.props.accessibilityLabel === 'FLAC').props.onPress();
    render('tracks').find(node => node.props.accessibilityLabel === 'MP3').props.onPress();
    submit('tracks');
    expect(apply).toHaveBeenCalledWith({ ...EMPTY_SECTION_FILTERS, genre: 'Jazz', formats: 'flac, mp3' });
    expect(render('tracks').some(node => node.type === 'TextInput')).toBe(false);
  });

  it('uses the calendar without limiting creation dates to listening history', () => {
    render('playlists').find(node => node.props.accessibilityLabel === 'filter_controls.choose_dates').props.onPress();
    expect(useCustomDateModalStore.getState().restrictToHistory).toBe(false);
    useCustomDateModalStore.getState().onApply!(new Date(2020, 0, 1), new Date(2021, 1, 2));
    submit('playlists');
    expect(apply).toHaveBeenCalledWith({ ...EMPTY_SECTION_FILTERS, createdFrom: '2020-01-01', createdTo: '2021-02-02' });
    useCustomDateModalStore.getState().close();
    expect(useCustomDateModalStore.getState().restrictToHistory).toBe(true);
  });
});
