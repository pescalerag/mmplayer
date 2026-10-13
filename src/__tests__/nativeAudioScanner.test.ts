import * as scanner from '../../modules/native-audio-scanner';
import { requireNativeModule } from 'expo-modules-core';

jest.unmock('../../modules/native-audio-scanner');
jest.mock('expo-modules-core', () => {
  const native: Record<string, jest.Mock> = {};
  return { requireNativeModule: jest.fn(() => new Proxy(native, {
    get(target, name: string) { return target[name] ??= jest.fn(); },
  })) };
});

const native = requireNativeModule('NativeAudioScanner') as Record<string, jest.Mock>;

beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

it('preserves scan options, metadata and byte offsets at the native boundary', async () => {
  native.getAudioFiles.mockResolvedValue([{ id: 'song' }]);
  expect(await scanner.getAudioFiles()).toEqual([{ id: 'song' }]);
  expect(native.getAudioFiles).toHaveBeenCalledWith(false);
  await scanner.getAudioFiles(true);
  expect(native.getAudioFiles).toHaveBeenLastCalledWith(true);
  native.readFileChunk.mockResolvedValue('YWJj');
  expect(await scanner.readFileChunk('content://song', 127, 3)).toBe('YWJj');
  expect(native.readFileChunk).toHaveBeenCalledWith('content://song', 127, 3);
  const metadata = { title: 'Canción', year: 2026, albumArtist: null };
  await scanner.updateMetadata('file:///song', metadata);
  expect(native.updateMetadata).toHaveBeenCalledWith('file:///song', metadata);
  const batch = [{ filePath: 'file:///song', metadata }];
  await scanner.updateMetadataBatch(batch);
  expect(JSON.parse(native.updateMetadataBatch.mock.calls[0][0])).toEqual(batch);
});

it.each([
  ['getReplayGainMetadata', ['uri'], { gain: -3, peak: 0.8 }],
  ['getReplayGain', ['uri'], -3],
  ['readMetadata', ['uri'], { title: 'Song' }],
  ['cancelUpdateMetadataBatch', [], undefined],
  ['scanMultipleFiles', [['a', 'b']], true],
  ['requestWritePermission', [['a']], false],
  ['getStorageStats', [], { totalBytes: 100, freeBytes: 50, usedBytes: 50 }],
  ['updateWidget', ['Song', 'Artist', null, true], undefined],
  ['acquireCastWakeLock', [], true],
  ['releaseCastWakeLock', [], true],
  ['isBatteryOptimizationIgnored', [], false],
  ['requestIgnoreBatteryOptimizations', [], true],
  ['findAndScanUnindexedAudioFiles', [['known']], ['new']],
  ['checkFilesExistOnDisk', [['a', 'b']], [true, false]],
  ['generateVideoThumbnail', ['video', 'destination'], 'thumbnail'],
  ['setRingtone', ['uri', scanner.RingtoneType.ALARM], { success: true }],
  ['resolveAudioUriInfo', ['uri'], { title: 'Song' }],
] as const)('returns the native result for %s without changing arguments', async (name, args, result) => {
  native[name].mockResolvedValue(result);
  const call = scanner[name] as (...args: any[]) => Promise<unknown>;
  expect(await call(...args)).toEqual(result);
  expect(native[name]).toHaveBeenCalledWith(...args);
});

it.each([
  ['acquireCastWakeLock', [], false],
  ['releaseCastWakeLock', [], false],
  ['isBatteryOptimizationIgnored', [], true],
  ['requestIgnoreBatteryOptimizations', [], false],
  ['findAndScanUnindexedAudioFiles', [['known']], []],
  ['checkFilesExistOnDisk', [['a', 'b']], [false, false]],
  ['generateVideoThumbnail', ['video', 'destination'], null],
  ['resolveAudioUriInfo', ['uri'], null],
] as const)('uses its safe fallback when %s fails', async (name, args, fallback) => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  native[name].mockRejectedValueOnce(new Error('Native unavailable'));
  const call = scanner[name] as (...args: any[]) => Promise<unknown>;
  expect(await call(...args)).toEqual(fallback);
});

it('handles denied settings access and reports ringtone errors', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  native.canWriteSettings.mockReturnValueOnce(true).mockImplementationOnce(() => { throw Error('Denied'); });
  expect(scanner.canWriteSettings()).toBe(true);
  expect(scanner.canWriteSettings()).toBe(false);
  scanner.openWriteSettingsPermission();
  expect(native.openWriteSettingsPermission).toHaveBeenCalledTimes(1);
  native.openWriteSettingsPermission.mockImplementationOnce(() => { throw Error('Denied'); });
  expect(() => scanner.openWriteSettingsPermission()).not.toThrow();
  native.setRingtone.mockRejectedValueOnce(new Error('Denied')).mockRejectedValueOnce(null);
  expect(await scanner.setRingtone('uri', scanner.RingtoneType.RINGTONE)).toEqual({ success: false, error: 'Denied' });
  expect(await scanner.setRingtone('uri', scanner.RingtoneType.NOTIFICATION)).toEqual({ success: false, error: 'UNKNOWN_ERROR' });
});

it('handles launch URI lifecycle and passes audio-open events to the listener', () => {
  native.getLaunchAudioUri.mockReturnValueOnce('content://song').mockReturnValueOnce(undefined)
    .mockImplementationOnce(() => { throw Error('Unavailable'); });
  expect(scanner.getLaunchAudioUri()).toBe('content://song');
  expect(scanner.getLaunchAudioUri()).toBeNull();
  expect(scanner.getLaunchAudioUri()).toBeNull();
  native.clearLaunchAudioUri.mockReturnValueOnce(true).mockReturnValueOnce(undefined)
    .mockImplementationOnce(() => { throw Error('Unavailable'); });
  expect(scanner.clearLaunchAudioUri()).toBe(true);
  expect(scanner.clearLaunchAudioUri()).toBe(false);
  expect(scanner.clearLaunchAudioUri()).toBe(false);
  const listener = jest.fn(); const subscription = { remove: jest.fn() };
  native.addListener.mockReturnValue(subscription);
  expect(scanner.addAudioFileOpenedListener(listener)).toBe(subscription);
  expect(native.addListener).toHaveBeenCalledWith('onAudioFileOpened', listener);
  native.addListener.mock.calls[0][1]({ uri: 'content://song' });
  expect(listener).toHaveBeenCalledWith({ uri: 'content://song' });
});
