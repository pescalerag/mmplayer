import { PermissionsAndroid, Platform } from 'react-native';
import { MusicZipImportService } from '../services/MusicZipImportService';
import { addMusicZipProgressListener, clearLaunchAudioUri, getOpenedFileInfo, importMusicZip } from '../../modules/native-audio-scanner';
import { pickDocumentForCopy } from '../services/DocumentPickerService';
import { ScannerService } from '../services/ScannerService';
import { useBackupStore } from '../store/useBackupStore';

jest.mock('react-native', () => ({ Platform: { OS: 'android', Version: 33, select: (options: any) => options.android ?? options.default },
    PermissionsAndroid: { request: jest.fn(), PERMISSIONS: { WRITE_EXTERNAL_STORAGE: 'write' }, RESULTS: { GRANTED: 'granted' } },
}));
jest.mock('../../modules/native-audio-scanner', () => ({ addMusicZipProgressListener: jest.fn(), clearLaunchAudioUri: jest.fn(), getOpenedFileInfo: jest.fn(), importMusicZip: jest.fn() }));
jest.mock('../services/ScannerService', () => ({ ScannerService: { syncLibrary: jest.fn() } }));
jest.mock('../services/DocumentPickerService', () => ({ pickDocumentForCopy: jest.fn() }));

const original = useBackupStore.getState();
const remove = jest.fn();
beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    Object.assign(Platform, { OS: 'android', Version: 33 });
    useBackupStore.setState({ isVisible: false, mode: 'idle', startImport: jest.fn(), setError: jest.fn(), setSuccess: jest.fn() });
    (addMusicZipProgressListener as jest.Mock).mockReturnValue({ remove });
    (importMusicZip as jest.Mock).mockResolvedValue({ folder: 'Music/Album', imported: 2, skipped: 1 });
    (ScannerService.syncLibrary as jest.Mock).mockResolvedValue(undefined);
    (getOpenedFileInfo as jest.Mock).mockResolvedValue({ name: 'Album.zip', mimeType: 'application/zip' });
    (pickDocumentForCopy as jest.Mock).mockResolvedValue({ canceled: false, assets: [{ uri: 'content://provider/zip', name: 'Album.zip' }] });
});
afterEach(() => { useBackupStore.setState(original); jest.restoreAllMocks(); });

it('picks ZIPs, imports to native Music storage, refreshes the library and removes the progress listener', async () => {
    await MusicZipImportService.pickAndImportZip();
    expect(pickDocumentForCopy).toHaveBeenCalledWith(['application/zip', 'application/x-zip-compressed']);
    expect(importMusicZip).toHaveBeenCalledWith('content://provider/zip', 'Album.zip');
    expect(ScannerService.syncLibrary).toHaveBeenCalledWith(undefined, true, undefined, true);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(useBackupStore.getState().setSuccess).toHaveBeenCalledWith(expect.stringContaining('Music/Album'));
    expect(useBackupStore.getState().setError).not.toHaveBeenCalled();
});

it('does nothing when document selection is canceled', async () => {
    (pickDocumentForCopy as jest.Mock).mockResolvedValue({ canceled: true });
    await MusicZipImportService.pickAndImportZip();
    expect(importMusicZip).not.toHaveBeenCalled();
    expect(useBackupStore.getState().startImport).not.toHaveBeenCalled();
});

it('routes provider ZIPs before audio handling and deduplicates repeated opening events', async () => {
    const url = 'content://provider/opened-zip';
    expect(await MusicZipImportService.handleOpenedZip(url)).toBe(true);
    expect(await MusicZipImportService.handleOpenedZip(url)).toBe(true);
    expect(importMusicZip).toHaveBeenCalledTimes(1);
    expect(clearLaunchAudioUri).toHaveBeenCalledTimes(1);
});

it('recognizes ZIP filenames even when a provider reports a generic MIME type', async () => {
    (getOpenedFileInfo as jest.Mock).mockResolvedValue({ name: 'Another.ZIP', mimeType: 'application/octet-stream' });
    expect(await MusicZipImportService.handleOpenedZip('content://provider/generic-zip')).toBe(true);
    expect(importMusicZip).toHaveBeenCalled();
});

it('leaves ordinary audio and unrelated links to their existing handlers', async () => {
    (getOpenedFileInfo as jest.Mock).mockResolvedValue({ name: 'Song.mp3', mimeType: 'audio/mpeg' });
    expect(await MusicZipImportService.handleOpenedZip('content://provider/audio')).toBe(false);
    expect(await MusicZipImportService.handleOpenedZip('file:///music/song.mp3')).toBe(false);
    expect(await MusicZipImportService.handleOpenedZip('mmplayer://player')).toBe(false);
    expect(await MusicZipImportService.handleOpenedZip('https://example.com/a.zip')).toBe(false);
    expect(importMusicZip).not.toHaveBeenCalled();
});

it.each(['no_audio', 'not_enough_space', 'invalid_archive', 'unsafe_path'])('shows %s errors without scanning partial imports', async key => {
    (importMusicZip as jest.Mock).mockRejectedValue(new Error('music_zip.' + key));
    await MusicZipImportService.importZip('file:///bad.zip', 'bad.zip');
    expect(useBackupStore.getState().setError).toHaveBeenCalled();
    expect(useBackupStore.getState().setSuccess).not.toHaveBeenCalled();
    expect(ScannerService.syncLibrary).not.toHaveBeenCalled(); expect(remove).toHaveBeenCalledTimes(1);
});

it('distinguishes copied music from a failed library refresh', async () => {
    (ScannerService.syncLibrary as jest.Mock).mockRejectedValue(new Error('Permission denied'));
    await MusicZipImportService.importZip('file:///album.zip', 'Album.zip');
    expect(useBackupStore.getState().setError).toHaveBeenCalledWith(expect.stringContaining('Music/Album'));
    expect(useBackupStore.getState().setSuccess).not.toHaveBeenCalled();
});

it('requests legacy write permission only on Android 9 and older', async () => {
    Object.assign(Platform, { Version: 28 });
    (PermissionsAndroid.request as jest.Mock).mockResolvedValue('denied');
    await MusicZipImportService.importZip('file:///album.zip', 'Album.zip');
    expect(PermissionsAndroid.request).toHaveBeenCalledWith('write');
    expect(importMusicZip).not.toHaveBeenCalled();
    expect(useBackupStore.getState().setError).toHaveBeenCalled();
});

it('does not start a second import while the first native operation is pending', async () => {
    let finish!: (value: unknown) => void;
    (importMusicZip as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const first = MusicZipImportService.importZip('file:///first.zip', 'first.zip');
    await MusicZipImportService.importZip('file:///second.zip', 'second.zip');
    expect(importMusicZip).toHaveBeenCalledTimes(1);
    finish({ folder: 'Music/first', imported: 1, skipped: 0 }); await first;
});
