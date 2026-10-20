import React from 'react';
import { PlaybackCassetteArtwork } from '../components/player/PlaybackCassetteArtwork';

let mockTrackId: string | undefined;
jest.mock('../store/usePlaybackSnapshotStore', () => ({ usePlaybackSnapshotStore: (selector: any) => selector({ trackId: 'incoming' }) }));
let mockPlaying = 'playing';
let mockFocused = true;
let mockAppActive = true;
let mockPosition = 30;
let mockDuration = 120;
let mockShowAlbumName = false;
const mockRemove = jest.fn();
jest.mock('react-native', () => ({ AppState: { currentState: 'active', addEventListener: () => ({ remove: mockRemove }) } }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused }));
jest.mock('react-native-track-player', () => ({ State: { Playing: 'playing' }, usePlaybackState: () => ({ state: mockPlaying }), useProgress: () => ({ position: mockPosition, duration: mockDuration, trackId: mockTrackId }) }));
jest.mock('../components/player/CassetteArtwork', () => ({ CassetteArtwork: 'CassetteArtwork' }));
jest.mock('../store/useSettingsStore', () => ({ useSettingsStore: (selector: any) => selector({ showCassetteAlbumName: mockShowAlbumName }) }));

beforeEach(() => {
    mockTrackId = undefined;
    mockPlaying = 'playing'; mockFocused = true; mockAppActive = true; mockPosition = 30; mockDuration = 120;
    mockShowAlbumName = false;
    jest.spyOn(React, 'useState').mockImplementation(() => [mockAppActive, jest.fn()] as any);
    jest.spyOn(React, 'useEffect').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());
const render = () => PlaybackCassetteArtwork({ size: 300, coverUrl: 'file:///cover.jpg', coverColor: '#50a7cc', albumTitle: 'My album' });

it('only passes the album name to the cassette when its setting is enabled', () => {
    expect(render().props.albumTitle).toBeNull();
    mockShowAlbumName = true;
    expect(render().props.albumTitle).toBe('My album');
});

it('uses the active track position for the cassette reels', () => {
    expect(render().props.progress).toBe(0.25);
    expect(render().props.isPlaying).toBe(true);
    expect(render().props.coverColor).toBe('#50a7cc');
    mockPosition = 0; mockDuration = 0;
    expect(render().props.progress).toBe(0);
});

it('stops rotating for paused playback, another screen or a backgrounded app', () => {
    mockPlaying = 'paused'; expect(render().props.isPlaying).toBe(false);
    mockPlaying = 'playing'; mockFocused = false; expect(render().props.isPlaying).toBe(false);
    mockFocused = true; mockAppActive = false; expect(render().props.isPlaying).toBe(false);
});


it('ignores a delayed outgoing progress sample once the incoming artwork is active', () => {
    mockTrackId = 'outgoing-instance';
    expect(render().props.progress).toBe(0);
    mockTrackId = 'incoming-instance';
    expect(render().props.progress).toBe(0.25);
});
