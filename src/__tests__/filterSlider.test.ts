import React from 'react';
import { NumericFilterSlider } from '../components/library/NumericFilterSlider';
import { FilterDisclosure } from '../components/library/FilterDisclosure';
import { changeFilterBound } from '../utils/filterSlider';

jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('../hooks/useAppTheme', () => ({ useAppTheme: () => ({ colors: { text: '#fff', textSecondary: '#aaa', cardBackground: '#222', accent: '#f00', onAccent: '#fff' }, fonts: { regular: 'regular', bold: 'bold' } }) }));
jest.mock('react-native', () => ({ Text: 'Text', View: 'View', TouchableOpacity: 'Button', StyleSheet: { create: (styles: any) => styles } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
const nodes = (tree: any): any[] => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];

describe('filter slider interaction', () => {
  let state: any;
  beforeEach(() => {
    state = undefined;
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
      if (state === undefined) state = initial;
      return [state, (value: any) => { state = typeof value === 'function' ? value(state) : value; }];
    }) as any);
  });
  afterEach(() => jest.restoreAllMocks());

  it('applies slider movement, exact step buttons and unlimited without a text input', () => {
    let value: number | null = null;
    const render = () => nodes(NumericFilterSlider({ label: 'Songs', value, maximum: 200, onChange: number => { value = number; } }));
    render().find(node => node.type === 'Slider').props.onValueChange(12);
    expect(value).toBe(12);
    render().find(node => node.props.accessibilityLabel === 'Songs: +').props.onPress();
    expect(value).toBe(13);
    render().find(node => node.props.accessibilityLabel === 'Songs: album_filters.unlimited').props.onPress();
    expect(value).toBeNull();
    render().find(node => node.type === 'Slider').props.onValueChange(0);
    expect(value).toBe(0);
    expect(render().some(node => node.type === 'TextInput')).toBe(false);
  });

  it('retains values outside initial ranges and lets users expand the range', () => {
    const render = () => nodes(NumericFilterSlider({ label: 'Songs', value: 500, maximum: 200, onChange: jest.fn() }));
    expect(render().find(node => node.type === 'Slider').props.maximumValue).toBe(500);
    render().find(node => node.props.accessibilityLabel === 'Songs: filter_controls.expand').props.onPress();
    expect(render().find(node => node.type === 'Slider').props.maximumValue).toBe(1000);
  });

  it('starts unused groups collapsed and exposes controls only after expanding', () => {
    const render = () => nodes(FilterDisclosure({ title: 'Duration', children: React.createElement('Slider') }));
    expect(render().some(node => node.type === 'Slider')).toBe(false);
    render().find(node => node.props.accessibilityLabel === 'Duration').props.onPress();
    expect(render().some(node => node.type === 'Slider')).toBe(true);
  });

  it('allows selecting years before the initial range', () => {
    const render = () => nodes(NumericFilterSlider({ label: 'Year', value: null, minimum: 1900, maximum: 2027, expandEarlier: true, onChange: jest.fn() }));
    render().find(node => node.props.accessibilityLabel === 'Year: filter_controls.earlier_years').props.onPress();
    expect(render().find(node => node.type === 'Slider').props.minimumValue).toBe(1800);
  });
});

it('automatically keeps both ends ordered and can remove either bound independently', () => {
  const draft = { minTracks: '2', maxTracks: '5' };
  expect(changeFilterBound(draft, 'minTracks', 8)).toEqual({ minTracks: '8', maxTracks: '8' });
  expect(changeFilterBound(draft, 'maxTracks', 1)).toEqual({ minTracks: '1', maxTracks: '1' });
  expect(changeFilterBound(draft, 'minTracks', null)).toEqual({ minTracks: '', maxTracks: '5' });
});
