import React from 'react';
import { PlayerDiscArtwork } from '../components/player/PlayerDiscArtwork';
import { VinylArtwork } from '../components/player/VinylArtwork';
import { CdArtwork } from '../components/player/CdArtwork';
import { DiscMask } from '../components/player/DiscMask';

jest.mock('react-native', () => ({ View: 'View', StyleSheet: { absoluteFillObject: {} } }));
jest.mock('react-native-reanimated', () => ({ __esModule: true, default: { View: 'AnimatedView' } }));
jest.mock('@react-native-masked-view/masked-view', () => 'MaskedView');
jest.mock('expo-image', () => ({ Image: 'Image' }));
jest.mock('react-native-svg', () => ({ __esModule: true, default: 'Svg', Circle: 'Circle', Defs: 'Defs', Path: 'Path', LinearGradient: 'LinearGradient', RadialGradient: 'RadialGradient', Stop: 'Stop' }));

const nodes = (tree: any): any[] => {
  if (!tree || typeof tree !== 'object') return [];
  if (tree.type === VinylArtwork) return nodes(VinylArtwork(tree.props));
  if (tree.type === CdArtwork) return nodes(CdArtwork(tree.props));
  if (tree.type === DiscMask) return nodes(DiscMask(tree.props));
  return [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)];
};
const render = (props: any) => nodes((PlayerDiscArtwork as any).type({ artworkSize: 300, spinStyle: { transform: [{ rotate: '20deg' }] }, coverColor: null, album: null, ...props }));

it('preserves existing custom CD images over the album cover with the redesigned SVG', () => {
  const album = { cdArtUrl: 'file:///custom-cd.jpg' };
  const tree = render({ playerCoverStyle: 'cd', album, coverUrl: 'file:///album.jpg' });
  expect(tree.filter(node => node.type === 'Image').map(node => node.props.source)).toEqual([{ uri: 'file:///custom-cd.jpg' }]);
  expect(tree.filter(node => node.type === 'Svg')).toHaveLength(2);
  expect(tree.find(node => node.type === 'MaskedView').props.maskElement.props.style.borderWidth).toBe((300 - 35) / 2);
  expect(album.cdArtUrl).toBe('file:///custom-cd.jpg');
  expect(tree.find(node => node.type === 'AnimatedView').props.style[1]).toEqual({ transform: [{ rotate: '20deg' }] });
});

it('scales the CD hole for previews and shows a metallic SVG without an image', () => {
  const preview = render({ playerCoverStyle: 'cd', album: { cdArtUrl: 'file:///custom-cd.jpg' }, artworkSize: 96, holeSize: 12 });
  expect(preview.find(node => node.type === 'MaskedView').props.maskElement.props.style.borderWidth).toBe(42);
  const plain = render({ playerCoverStyle: 'cd' });
  expect(plain.some(node => node.type === 'Image')).toBe(false);
  expect(plain.some(node => node.type === 'Circle' && node.props.fill === 'url(#cd-metal)')).toBe(true);
});

it('uses the cover when no custom CD image exists and accepts a changed custom image', () => {
  const cover = render({ playerCoverStyle: 'cd', album: { cdArtUrl: null }, coverUrl: 'file:///album.jpg' });
  expect(cover.find(node => node.type === 'Image').props.source.uri).toBe('file:///album.jpg');
  const custom = render({ playerCoverStyle: 'cd', album: { cdArtUrl: 'file:///new-cd.jpg' }, coverUrl: 'file:///album.jpg' });
  expect(custom.find(node => node.type === 'Image').props.source.uri).toBe('file:///new-cd.jpg');
});

it('colors the vinyl from the cover and uses the actual artwork for its circular label', () => {
  const vinyl = render({ playerCoverStyle: 'vinyl', coverColor: '#123456', coverUrl: 'file:///cover.jpg' });
  expect(vinyl.find(node => node.type === 'Circle' && node.props.r === '198').props.fill).toBe('#123456');
  const label = vinyl.find(node => node.type === 'Image');
  expect(label.props.source).toEqual({ uri: 'file:///cover.jpg' });
  expect(label.props.style.borderRadius).toBe(label.props.style.width / 2);
  expect(vinyl.find(node => node.type === 'AnimatedView').props.style[1]).toEqual({ transform: [{ rotate: '20deg' }] });
  const nextVinyl = render({ playerCoverStyle: 'vinyl', coverColor: '#c04060', coverUrl: 'file:///next.jpg' });
  expect(nextVinyl.find(node => node.type === 'Circle' && node.props.r === '198').props.fill).toBe('#c04060');
  expect(nextVinyl.find(node => node.type === 'Image').props.source.uri).toBe('file:///next.jpg');
});
