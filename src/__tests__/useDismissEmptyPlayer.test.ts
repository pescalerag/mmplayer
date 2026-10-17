import React from 'react';
import { useDismissEmptyPlayer } from '../hooks/useDismissEmptyPlayer';

let mockActiveTrack: { id: string } | null = null;
let mockSwitching = false;
let mockFocused = true;
const mockCloseSheet = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockParent = { canGoBack: mockCanGoBack, goBack: mockGoBack };
const mockNavigation = { getParent: () => mockParent };
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => mockFocused, useNavigation: () => mockNavigation }));
jest.mock('../store/usePlayerStore', () => ({ usePlayerStore: (selector: any) => selector({ activeTrack: mockActiveTrack }) }));
jest.mock('../store/useMultipleQueuesStore', () => ({ useMultipleQueuesStore: (selector: any) => selector({ isSwitching: mockSwitching }) }));
jest.mock('../store/useUIStore', () => ({ useUIStore: { getState: () => ({ closeSheet: mockCloseSheet }) } }));

beforeEach(() => {
    jest.clearAllMocks();
    mockActiveTrack = null; mockSwitching = false; mockFocused = true;
    mockCanGoBack.mockReturnValue(true);
    jest.spyOn(React, 'useEffect').mockImplementation(effect => { effect(); });
});
afterEach(() => jest.restoreAllMocks());

it('closes the queue overlay and pops the transparent player route after switching to an empty queue', () => {
    useDismissEmptyPlayer();
    expect(mockCloseSheet).toHaveBeenCalledTimes(1);
    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockCloseSheet.mock.invocationCallOrder[0]).toBeLessThan(mockGoBack.mock.invocationCallOrder[0]);
});

it('keeps the player open during a reset and when the destination has a song', () => {
    mockSwitching = true; useDismissEmptyPlayer();
    mockSwitching = false; mockActiveTrack = { id: 'next' }; useDismissEmptyPlayer();
    expect(mockCloseSheet).not.toHaveBeenCalled();
    expect(mockGoBack).not.toHaveBeenCalled();
});

it('leaves background player routes alone and safely handles a missing back route', () => {
    mockFocused = false; useDismissEmptyPlayer();
    expect(mockCloseSheet).not.toHaveBeenCalled();
    mockFocused = true; mockCanGoBack.mockReturnValue(false); useDismissEmptyPlayer();
    expect(mockCloseSheet).toHaveBeenCalledTimes(1);
    expect(mockGoBack).not.toHaveBeenCalled();
});
