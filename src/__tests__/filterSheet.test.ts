import React from 'react';
import SortModalSheet from '../components/sheets/SortModalSheet';
import { AlbumFilterControls } from '../components/library/AlbumFilterControls';
import { LibraryFilterControls } from '../components/library/LibraryFilterControls';
import { useLibraryStore } from '../store/useLibraryStore';
import { EMPTY_ALBUM_FILTERS } from '../utils/albumFilters';
import { EMPTY_SECTION_FILTERS } from '../utils/libraryFilters';

let mockTab = 'albums';
const mockClose = jest.fn();
jest.mock('@/hooks/useSheetProps', () => ({ useSheetProps: () => ({ props: { activeTab: mockTab, activeSort: 'name_asc' }, close: mockClose }) }));
jest.mock('@/hooks/useAppTheme', () => ({ useAppTheme: () => ({ colors: { text: '#fff', textSecondary: '#aaa', cardBackground: '#222', accent: '#f00', onAccent: '#fff' }, fonts: { regular: 'regular', bold: 'bold' }, layout: {} }) }));
jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-native', () => ({ Text: 'Text', View: 'View', ScrollView: 'ScrollView', TouchableOpacity: 'Button', Switch: 'Switch', useWindowDimensions: () => ({ height: 800 }), StyleSheet: { create: (styles: any) => styles } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const nodes = (tree: any): any[] => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];
describe('filter sheet layout and persistent actions', () => {
  let states: any[], cursor: number;
  const render = () => { cursor = 0; return SortModalSheet(); };
  beforeEach(() => {
    mockTab = 'albums'; states = []; cursor = 0; mockClose.mockClear();
    useLibraryStore.getState().setAlbumFilters(EMPTY_ALBUM_FILTERS);
    useLibraryStore.getState().setSectionFilters('tracks', EMPTY_SECTION_FILTERS);
    jest.spyOn(React, 'useMemo').mockImplementation(callback => callback());
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = typeof initial === 'function' ? initial() : initial;
      return [states[slot], (value: any) => { states[slot] = typeof value === 'function' ? value(states[slot]) : value; }];
    }) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('keeps Apply outside the scroll area and applies the controlled album slider draft', () => {
    const first = render();
    expect(first.props.style[1].height).toBe(560);
    const content = nodes(first);
    const scroll = content.find(node => node.type === 'ScrollView');
    expect(nodes(scroll).filter(node => node.type === 'Button').some(node => node.props.children?.props?.children === 'album_filters.apply')).toBe(false);
    const form = content.find(node => node.type === AlbumFilterControls);
    expect(form.props.hideActions).toBe(true);
    form.props.setDraft((previous: any) => ({ ...previous, minTracks: '8' }));
    nodes(render()).filter(node => node.type === 'Button').at(-1).props.onPress();
    expect(useLibraryStore.getState().albumFilters.minTracks).toBe(8);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('clears and applies section filters using the same fixed footer', () => {
    mockTab = 'tracks';
    useLibraryStore.getState().setSectionFilters('tracks', { ...EMPTY_SECTION_FILTERS, neverPlayed: true });
    const form = nodes(render()).find(node => node.type === LibraryFilterControls);
    expect(form.props.draft.neverPlayed).toBe(true);
    nodes(render()).filter(node => node.type === 'Button').at(-2).props.onPress();
    nodes(render()).filter(node => node.type === 'Button').at(-1).props.onPress();
    expect(useLibraryStore.getState().sectionFilters.tracks).toEqual(EMPTY_SECTION_FILTERS);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
