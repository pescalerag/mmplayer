import React from 'react';
import type Album from '../database/models/Album';
import { useAlbumCoverColor } from '../hooks/useAlbumCoverColor';
import { AlbumCoverColorService } from '../services/AlbumCoverColorService';

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
let state: any;
let effect: () => void | (() => void);
let cleanup: void | (() => void);
let getColor: jest.SpyInstance;

beforeEach(() => {
    state = null; cleanup = undefined;
    jest.spyOn(React, 'useState').mockImplementation(() => [state, ((value: any) => { state = value; })] as any);
    jest.spyOn(React, 'useEffect').mockImplementation(callback => { effect = callback; });
    getColor = jest.spyOn(AlbumCoverColorService, 'getColor').mockResolvedValue('#aabbcc');
});
afterEach(() => { cleanup?.(); jest.restoreAllMocks(); });
const mountEffect = () => { cleanup = effect(); };

it('returns the saved album color on the first render without starting another extraction', () => {
    const album = { coverUrl: 'file:///one.jpg?t=1', coverColorSource: 'file:///one.jpg?t=1', coverColor: '#112233' } as Album;
    expect(useAlbumCoverColor(album.coverUrl, album)).toBe('#112233'); mountEffect();
    expect(getColor).not.toHaveBeenCalled();
});

it('hides the preceding artwork color immediately when changing songs', async () => {
    expect(useAlbumCoverColor('file:///one.jpg')).toBeNull(); mountEffect(); await settle();
    expect(useAlbumCoverColor('file:///one.jpg')).toBe('#aabbcc');
    cleanup?.();
    expect(useAlbumCoverColor('file:///two.jpg')).toBeNull();
    expect(useAlbumCoverColor(null)).toBeNull(); mountEffect();
    expect(getColor).toHaveBeenCalledTimes(1);
});

it('ignores an earlier request that finishes after changing the artwork', async () => {
    let finishOld!: (color: string) => void;
    getColor.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; }));
    useAlbumCoverColor('file:///one.jpg'); mountEffect();
    cleanup?.(); useAlbumCoverColor('file:///two.jpg'); mountEffect(); await settle();
    finishOld('#ff0000'); await settle();
    expect(useAlbumCoverColor('file:///two.jpg')).toBe('#aabbcc');
    expect(state).toEqual({ source: 'file:///two.jpg', color: '#aabbcc' });
});

it('does not retain a previous color when an extraction fails', async () => {
    state = { source: 'file:///old.jpg', color: '#112233' };
    getColor.mockResolvedValueOnce(null);
    expect(useAlbumCoverColor('file:///new.jpg')).toBeNull(); mountEffect(); await settle();
    expect(useAlbumCoverColor('file:///new.jpg')).toBeNull();
});
