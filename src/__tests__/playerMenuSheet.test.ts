import React from 'react';
import { PermissionsAndroid } from 'react-native';
import PlayerMenuSheet from '../components/sheets/PlayerMenuSheet';
import { PlayerDiscArtwork } from '../components/player/PlayerDiscArtwork';
import BlurredBackground from '../components/layouts/BlurredBackground';

const mockAppearance = { coverUrl: 'file:///cover.jpg', cdArtUrl: 'file:///cd.jpg', coverColor: '#ab3456', gradientColors: ['#301010', '#100505', '#100505'] };
const mockSettings = {
  showPlayerVisualizer: false, showCanvas: true, playerCoverStyle: 'cover', playerBackgroundStyle: 'cover', playerVisualizerType: 'bars', playerVisualizerColorMode: 'cover',
  setPlayerCoverStyle: jest.fn(), setPlayerBackgroundStyle: jest.fn(), setShowCanvas: jest.fn(), setShowPlayerVisualizer: jest.fn(), setPlayerVisualizerType: jest.fn(), setPlayerVisualizerColorMode: jest.fn(),
};
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: () => mockSettings }));
jest.mock('../hooks/useSheetProps', () => ({ useSheetProps: () => ({ props: mockAppearance }) }));
jest.mock('../hooks/useAppTheme', () => ({ useAppTheme: () => ({ colors: { text: '#fff', textSecondary: '#aaa', background: '#000', cardBackground: '#222', accent: '#00ff00', onAccent: '#000', accentAlpha8: '#010', accentAlpha30: '#020' }, fonts: { regular: 'regular' }, layout: {}, spacing: {}, radii: {} }) }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('react-native', () => ({ View: 'View', Text: 'Text', Switch: 'Switch', TouchableOpacity: 'Button', Platform: { OS: 'android' }, PermissionsAndroid: { request: jest.fn(), PERMISSIONS: { RECORD_AUDIO: 'audio' }, RESULTS: { GRANTED: 'granted' } }, StyleSheet: { create: (styles: any) => styles, absoluteFillObject: {} } }));
jest.mock('react-native-gesture-handler', () => ({ ScrollView: 'ScrollView', TouchableOpacity: 'Button' }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' } }));
jest.mock('@react-native-masked-view/masked-view', () => 'MaskedView');
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'Gradient' }));
jest.mock('../components/layouts/BlurredBackground', () => ({ __esModule: true, default: 'BlurredBackground' }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 24 }) }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));

function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  if (typeof tree.type === 'function' && tree.type.name === 'PreviewOption') return nodes(tree.type(tree.props));
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
const render = () => nodes(PlayerMenuSheet());
beforeEach(() => {
  jest.clearAllMocks(); mockSettings.showPlayerVisualizer = false;
  jest.spyOn(React, 'useMemo').mockImplementation(callback => callback());
});
afterEach(() => jest.restoreAllMocks());

it('shows horizontal artwork previews with the current cover and configured CD', () => {
  const tree = render();
  expect(tree.filter(node => node.type === 'ScrollView' && node.props.horizontal)).toHaveLength(4);
  expect(tree.find(node => node.type === 'Image' && node.props.blurRadius === undefined).props.source).toEqual({ uri: mockAppearance.coverUrl });
  expect(tree.find(node => node.type === PlayerDiscArtwork && node.props.playerCoverStyle === 'cd').props.album.cdArtUrl).toBe(mockAppearance.cdArtUrl);
  tree.find(node => node.props.accessibilityLabel === 'visualizer.cover_style_vinyl').props.onPress();
  expect(mockSettings.setPlayerCoverStyle).toHaveBeenCalledWith('vinyl');
});

it('shows a blurred cover and the actual player gradient without extracting another color', () => {
  const tree = render();
  const blurredOption = tree.find(node => node.props.accessibilityLabel === 'visualizer.background_style_cover');
  const background = nodes(blurredOption).find(node => node.type === BlurredBackground);
  expect(background.props.imageUrl).toBe(mockAppearance.coverUrl);
  expect(background.props.blurIntensity).toBe(10);
  expect(background.props.gradientColors).toEqual(['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)', '#000']);
  expect(tree.some(node => node.type === 'Gradient' && node.props.colors === mockAppearance.gradientColors)).toBe(true);
  tree.find(node => node.props.accessibilityLabel === 'visualizer.background_style_gradient').props.onPress();
  expect(mockSettings.setPlayerBackgroundStyle).toHaveBeenCalledWith('gradient');
});

it('places the visualizer toggle after Canvas and retains permission gating', async () => {
  const toggles = render().filter(node => node.type === 'Switch');
  expect(toggles.map(node => node.props.accessibilityLabel)).toEqual(['visualizer.show_canvas', 'visualizer.enable']);
  (PermissionsAndroid.request as jest.Mock).mockResolvedValueOnce('denied').mockResolvedValueOnce('granted');
  await toggles[1].props.onValueChange(true);
  expect(mockSettings.setShowPlayerVisualizer).not.toHaveBeenCalled();
  await toggles[1].props.onValueChange(true);
  expect(mockSettings.setShowPlayerVisualizer).toHaveBeenCalledWith(true);
});

it('uses the cover color and app accent for circular swatches and retains visualizer choices', () => {
  mockSettings.showPlayerVisualizer = true;
  const tree = render();
  expect(tree.some(node => node.props.style?.some?.((style: any) => style?.backgroundColor === mockAppearance.coverColor))).toBe(true);
  expect(tree.some(node => node.props.style?.some?.((style: any) => style?.backgroundColor === '#00ff00'))).toBe(true);
  tree.find(node => node.props.accessibilityLabel === 'visualizer.color_accent').props.onPress();
  expect(mockSettings.setPlayerVisualizerColorMode).toHaveBeenCalledWith('accent');
  expect(tree.filter(node => node.props.onPress && node.props.children?.[1]?.props?.children === 'visualizer.style_bars')).toHaveLength(1);
  const styleList = tree.find(node => node.type === 'ScrollView' && nodes(node).some(child => child.props.children?.[1]?.props?.children === 'visualizer.style_bars'));
  expect(styleList.props.horizontal).toBe(true);
  const choices = nodes(styleList).filter(node => node.type === 'Button');
  expect(choices).toHaveLength(4);
  choices[1].props.onPress();
  expect(mockSettings.setPlayerVisualizerType).toHaveBeenCalledWith('wave');
});
