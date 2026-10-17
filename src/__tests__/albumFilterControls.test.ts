import React from 'react';
import { AlbumFilterControls } from '../components/library/AlbumFilterControls';
import { useLibraryStore } from '../store/useLibraryStore';
import { EMPTY_ALBUM_FILTERS } from '../utils/albumFilters';
import { NumericFilterSlider } from '../components/library/NumericFilterSlider';

jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

jest.mock('../hooks/useAppTheme', () => ({ useAppTheme: () => ({ colors: { text: '#fff', textSecondary: '#aaa', cardBackground: '#222', accent: '#f00', onAccent: '#fff' }, fonts: { regular: 'regular', bold: 'bold' } }) }));
jest.mock('react-native', () => ({ Text: 'Text', TextInput: 'TextInput', View: 'View', Switch: 'Switch', TouchableOpacity: 'Button', StyleSheet: { create: (styles: any) => styles } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}

describe('album filter form', () => {
  let state: any[], cursor: number;
  const apply = jest.fn();
  const render = () => { cursor = 0; return nodes(AlbumFilterControls({ onApply: apply })); };
  beforeEach(() => {
    state = []; cursor = 0; apply.mockClear();
    useLibraryStore.getState().setAlbumFilters(EMPTY_ALBUM_FILTERS);
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
      const slot = cursor++;
      if (!(slot in state)) state[slot] = typeof initial === 'function' ? initial() : initial;
      return [state[slot], (value: any) => { state[slot] = typeof value === 'function' ? value(state[slot]) : value; }];
    }) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('restores saved bounds and submits slider values only when Apply is pressed', () => {
    useLibraryStore.getState().setAlbumFilters({ ...EMPTY_ALBUM_FILTERS, minTracks: 4 });
    const first = render();
    const fields = first.filter(node => node.type === NumericFilterSlider);
    expect(fields.map(field => field.props.value)).toEqual([4, null, null, null, null, null, null]);
    fields[1].props.onChange(12);
    fields[2].props.onChange(1990);
    expect(apply).not.toHaveBeenCalled();
    render().filter(node => node.type === 'Button')[1].props.onPress();
    expect(apply).toHaveBeenCalledWith({ ...EMPTY_ALBUM_FILTERS, minTracks: 4, maxTracks: 12, minYear: 1990, maxYear: null });
  });

  it('submits duration, rating and missing artwork together and resets the switch', () => {
    render().filter(node => node.type === NumericFilterSlider)[4].props.onChange(30);
    render().filter(node => node.type === NumericFilterSlider)[5].props.onChange(60);
    render().filter(node => node.type === NumericFilterSlider)[6].props.onChange(4.5);
    render().find(node => node.type === 'Switch').props.onValueChange(true);
    render().filter(node => node.type === 'Button')[1].props.onPress();
    expect(apply).toHaveBeenCalledWith({ ...EMPTY_ALBUM_FILTERS, minDuration: 30, maxDuration: 60, minRating: 4.5, withoutCover: true });
    render().filter(node => node.type === 'Button')[0].props.onPress();
    expect(render().find(node => node.type === 'Switch').props.value).toBe(false);
  });

  it('keeps slider bounds ordered and clears all limits', () => {
    render().filter(node => node.type === NumericFilterSlider)[0].props.onChange(10);
    render().filter(node => node.type === NumericFilterSlider)[1].props.onChange(5);
    render().filter(node => node.type === 'Button')[1].props.onPress();
    expect(apply).toHaveBeenLastCalledWith({ ...EMPTY_ALBUM_FILTERS, minTracks: 5, maxTracks: 5 });
    render().filter(node => node.type === 'Button')[0].props.onPress();
    expect(render().filter(node => node.type === NumericFilterSlider).every(node => node.props.value === null)).toBe(true);
    render().filter(node => node.type === 'Button')[1].props.onPress();
    expect(apply).toHaveBeenCalledWith(EMPTY_ALBUM_FILTERS);
  });
});
