import React, { type ReactElement } from 'react';
import TrackPlayer from 'react-native-track-player';
import PlayPauseButton from '../components/common/PlayPauseButton';

let mockPlaying = true;
jest.mock('../hooks/usePlaybackState', () => ({ usePlaybackState: () => ({ state: mockPlaying ? 'playing' : 'paused' }) }));
jest.mock('react-native-track-player', () => ({
    __esModule: true,
    State: { Playing: 'playing', Buffering: 'buffering' },
    default: { play: jest.fn().mockResolvedValue(undefined), pause: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('react-native', () => ({ TouchableOpacity: 'TouchableOpacity' }));

describe('play/pause button responsiveness', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        mockPlaying = true;
        // Invoke this small component without a renderer; preserve the refs in its press handler.
        jest.spyOn(React, 'useRef').mockImplementation(initial => ({ current: initial }));
    });
    afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
    const pressHandler = () => (PlayPauseButton({}) as ReactElement<{ onPress: () => Promise<void> }>).props.onPress;

    it('accepts play while the previous pause acknowledgement is pending', async () => {
        let resolve!: () => void;
        (TrackPlayer.pause as jest.Mock).mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
        const press = pressHandler();
        const pending = press();
        await press();
        expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
        resolve();
        await pending;
        expect(jest.getTimerCount()).toBe(0);
    });

    it('accepts pause while the previous play acknowledgement is pending', async () => {
        mockPlaying = false;
        let resolve!: () => void;
        (TrackPlayer.play as jest.Mock).mockImplementationOnce(() => new Promise<void>(done => { resolve = done; }));
        const press = pressHandler();
        const pending = press();
        await press();
        expect(TrackPlayer.play).toHaveBeenCalledTimes(1);
        expect(TrackPlayer.pause).toHaveBeenCalledTimes(1);
        resolve();
        await pending;
    });
});
