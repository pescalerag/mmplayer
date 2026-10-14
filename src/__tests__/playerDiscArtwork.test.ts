import React from 'react';
import { PlayerDiscArtwork } from '../components/player/PlayerDiscArtwork';

jest.mock('react-native', () => ({ View: 'View', StyleSheet: { absoluteFillObject: {} } }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' } }));
jest.mock('@react-native-masked-view/masked-view', () => 'MaskedView');
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('../assets/cd-base.webp', () => 'cd-base');
jest.mock('../assets/cd-custom.svg', () => 'cd-custom');
jest.mock('../assets/vinyl.svg', () => 'vinyl');

const nodes = (tree: any): any[] => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];
const render = (props: any) => nodes((PlayerDiscArtwork as any).type({ artworkSize: 300, spinStyle: { transform: [{ rotate: '20deg' }] }, coverColor: null, album: null, ...props }));

it('uses the configured CD artwork and the same overlay as PlayerScreen', () => {
  const tree = render({ playerCoverStyle: 'cd', album: { cdArtUrl: 'file:///custom-cd.jpg' } });
  expect(tree.filter(node => node.type === 'Image').map(node => node.props.source)).toEqual([{ uri: 'file:///custom-cd.jpg' }, 'cd-custom']);
  expect(tree.find(node => node.type === 'MaskedView').props.maskElement.props.style.borderWidth).toBe((300 - 35) / 2);
});

it('scales the CD hole for static previews and uses the base CD when no image is configured', () => {
  const preview = render({ playerCoverStyle: 'cd', album: { cdArtUrl: 'file:///custom-cd.jpg' }, artworkSize: 96, holeSize: 12 });
  expect(preview.find(node => node.type === 'MaskedView').props.maskElement.props.style.borderWidth).toBe(42);
  expect(render({ playerCoverStyle: 'cd' }).find(node => node.type === 'Image').props.source).toBe('cd-base');
});

it('keeps the vinyl asset and its cover-derived tint', () => {
  const vinyl = render({ playerCoverStyle: 'vinyl', coverColor: '#123456' });
  expect(vinyl.find(node => node.type === 'Image').props.source).toBe('vinyl');
  expect(vinyl.find(node => node.props.style?.backgroundColor === '#123456').props.style.opacity).toBe(0.25);
});
