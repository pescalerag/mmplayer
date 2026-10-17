import React from 'react';
import { Alert } from 'react-native';
import MetadataEditorSheet from '../components/sheets/MetadataEditorSheet';

const mockDownload = jest.fn();
const mockSave = jest.fn();
const mockToast = jest.fn();
const mockTracks = [{ id: 'song1', fileUrl: 'file:///song.mp3', album: { id: 'album1' } }];
jest.mock('../hooks/useSheetProps', () => ({ useSheetProps: () => ({ isVisible: true, props: { tracks: mockTracks }, close: jest.fn() }) }));
jest.mock('../hooks/useAppTheme', () => ({ useAppTheme: () => ({ colors: { accent: '#f00', text: '#fff' }, fonts: { regular: 'regular' }, fontWeights: { semiBold: '600' } }) }));
jest.mock('../store/useMultiSelectStore', () => ({ useMultiSelectStore: () => ({ exitSelectionMode: jest.fn() }) }));
jest.mock('../store/useToastStore', () => ({ useToastStore: { getState: () => ({ showToast: mockToast }) } }));
jest.mock('../services/MetadataEditorService', () => ({ MetadataEditorService: { saveMetadata: (...args: any[]) => mockSave(...args) } }));
jest.mock('../services/AlbumCoverService', () => ({ AlbumCoverService: { downloadCover: (...args: any[]) => mockDownload(...args) }, isMissingAlbumCover: (uri: string | null) => !uri || uri === 'file:///nullcover.png' }));
jest.mock('../database', () => ({ database: {} }));
jest.mock('../../modules/native-audio-scanner', () => ({ readMetadata: jest.fn() }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Icon' }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));
jest.mock('expo-file-system/legacy', () => ({ deleteAsync: jest.fn(async () => {}) }));
jest.mock('react-native', () => ({ View: 'View', Text: 'Text', TextInput: 'Input', TouchableOpacity: 'Button', ScrollView: 'ScrollView', ActivityIndicator: 'Spinner', Image: 'Image', Alert: { alert: jest.fn() }, Keyboard: { dismiss: jest.fn() }, Platform: { OS: 'android' }, StyleSheet: { create: (styles: any) => styles, absoluteFillObject: {} } }));

let states: any[], stateIndex: number, refs: any[], refIndex: number;
const nodes = (tree: any): any[] => tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];
const render = () => { stateIndex = 0; refIndex = 0; return nodes(MetadataEditorSheet()); };
const searchButton = (tree: any[]) => tree.find(node => node.type === 'Button' && node.props.children?.[1]?.props.children === 'metadata_editor.search_cover');
beforeEach(() => {
    jest.clearAllMocks();
    mockTracks.splice(0, mockTracks.length, { id: 'song1', fileUrl: 'file:///song.mp3', album: { id: 'album1' } });
    states = ['Song', 'Daft Punk', '', 'Discovery', '', '', '', '', null, null, false]; refs = [];
    mockDownload.mockResolvedValue('file:///cache/download.jpg'); mockSave.mockResolvedValue(undefined);
    jest.spyOn(React, 'useEffect').mockImplementation(() => {});
    jest.spyOn(React, 'useMemo').mockImplementation(callback => callback());
    jest.spyOn(React, 'useRef').mockImplementation((initial: any) => { const index = refIndex++; refs[index] ??= { current: initial }; return refs[index]; });
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
        const index = stateIndex++; if (!(index in states)) states[index] = typeof initial === 'function' ? initial() : initial;
        return [states[index], (value: any) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    }) as any);
});
afterEach(() => jest.restoreAllMocks());

it('stages a missing cover and only writes metadata when Save is pressed', async () => {
    await searchButton(render()).props.onPress();
    // The event handler starts an async search without blocking the UI.
    await Promise.resolve();
    expect(mockDownload).toHaveBeenCalledWith('Discovery', 'Daft Punk');
    expect(states[9]).toBe('file:///cache/download.jpg');
    expect(mockSave).not.toHaveBeenCalled();
    const save = render().find(node => node.type === 'Button' && node.props.children?.props?.children === 'metadata_editor.save');
    await save.props.onPress();
    expect(mockSave).toHaveBeenCalledWith(mockTracks, expect.objectContaining({ coverArtPath: 'file:///cache/download.jpg' }), false, false, expect.any(Function));
});

it('requires a replacement confirmation before searching when a cover exists', async () => {
    states[8] = 'file:///existing-cover.jpg';
    searchButton(render()).props.onPress();
    expect(mockDownload).not.toHaveBeenCalled();
    const options = (Alert.alert as jest.Mock).mock.calls[0][2];
    expect(options[0].style).toBe('cancel');
    options[1].onPress(); await Promise.resolve();
    expect(mockDownload).toHaveBeenCalledTimes(1);
});

it('leaves the existing cover intact when the provider finds no match', async () => {
    mockDownload.mockResolvedValue(null);
    await searchButton(render()).props.onPress(); await Promise.resolve();
    expect(states[9]).toBeNull();
    expect(mockToast).toHaveBeenCalledWith('metadata_editor.cover_not_found', 'information-circle');
});

it('offers the cover search for a batch from one album and saves it for all selected tracks', async () => {
    mockTracks.push({ id: 'song2', fileUrl: 'file:///song2.mp3', album: { id: 'album1' } });
    const search = searchButton(render());
    expect(search.props.disabled).toBe(false);
    await search.props.onPress(); await Promise.resolve();
    const save = render().find(node => node.type === 'Button' && node.props.children?.props?.children === 'metadata_editor.save');
    await save.props.onPress();
    expect(mockSave).toHaveBeenCalledWith(mockTracks, expect.objectContaining({ coverArtPath: 'file:///cache/download.jpg' }), true, false, expect.any(Function));
});

it('does not offer a cover search for a batch from different albums even if the album text matches', () => {
    mockTracks.push({ id: 'song2', fileUrl: 'file:///song2.mp3', album: { id: 'album2' } });
    expect(searchButton(render())).toBeUndefined();
});

it('keeps the replacement confirmation for batches from the same album', () => {
    mockTracks.push({ id: 'song2', fileUrl: 'file:///song2.mp3', album: { id: 'album1' } });
    states[8] = 'file:///existing-cover.jpg';
    searchButton(render()).props.onPress();
    expect(Alert.alert).toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
});
