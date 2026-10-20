import { createMMKV } from 'react-native-mmkv';
import TrackPlayer from 'react-native-track-player';
import { database } from '../database';
import { runNativeRuntimeDiagnostics, RuntimeTestResult, getNativePlaybackSnapshot } from '../../modules/native-equalizer';
import { normalizeOpaqueColor } from '../utils/customColors';
import { AppErrorService, describeError } from './AppErrorService';

async function test(name: string, run: () => Promise<string> | string): Promise<RuntimeTestResult> {
    const start = Date.now();
    try { return { name, status: 'pass', detail: await run(), durationMs: Date.now() - start }; }
    catch (error) {
        AppErrorService.record('Runtime test: ' + name, error);
        return { name, status: 'fail', detail: describeError(error), durationMs: Date.now() - start };
    }
}

// These checks execute the installed release's native bridges. They never change
// the user's library, entitlement, effects or transport state.
export async function runRuntimeTests(onResult: (result: RuntimeTestResult) => void): Promise<void> {
    const checks: [string, () => Promise<string> | string][] = [
        ['MMKV: native persistence round trip', () => {
            const storage = createMMKV({ id: 'runtime-diagnostics' });
            const value = JSON.stringify({ color: '#fa8072', rating: 4.5, time: Date.now() });
            try {
                storage.set('probe', value);
                if (storage.getString('probe') !== value) throw new Error('MMKV round trip failed');
                return 'OK';
            } finally { storage.remove('probe'); }
        }],
        ['WatermelonDB: native reads and model deserialization', async () => {
            const counts: string[] = [];
            for (const name of ['tracks', 'albums', 'artists', 'tags', 'playlists']) {
                const collection = database.get(name);
                const count = await collection.query().fetchCount();
                // A bounded fetch also exercises R8-sensitive model construction.
                const { Q } = await import('@nozbe/watermelondb');
                const rows = await collection.query(Q.take(1)).fetch();
                if (rows.length && typeof rows[0].id !== 'string') throw new Error('Invalid model: ' + name);
                counts.push(name + ': ' + count);
            }
            return counts.join('\n');
        }],
        ['TrackPlayer: native transport and snapshot reads', async () => {
            const [state, progress, snapshot] = await Promise.all([TrackPlayer.getPlaybackState(), TrackPlayer.getProgress(), getNativePlaybackSnapshot()]);
            if (!state || !Number.isFinite(progress.position)) throw new Error('Invalid playback response');
            return JSON.stringify({ state, progress, snapshotAvailable: snapshot !== null });
        }],
        ['Custom colours: persisted hex normalization', () => {
            if (normalizeOpaqueColor('#FA8072')?.toLowerCase() !== '#fa8072') throw new Error('Colour normalization failed');
            return 'OK';
        }],
    ];
    for (const [name, run] of checks) onResult(await test(name, run));
    try {
        for (const result of await runNativeRuntimeDiagnostics()) {
            if (result.status === 'fail') AppErrorService.record('Native runtime test: ' + result.name, result.detail);
            onResult(result);
        }
    } catch (error) {
        onResult(await test('Native diagnostics bridge', () => { throw error; }));
    }
}
