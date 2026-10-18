import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { AndroidConfig } = require('@expo/config-plugins');
const { restrictAudioFileIntents } = require('../../plugins/withAudioFileIntents');
const audioMimes = ['audio/*', 'application/ogg', 'application/x-ogg', 'application/opus'];
const allowedMimes = [...audioMimes, 'application/zip', 'application/x-zip-compressed'];
const launcher = { action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }], category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }] };
const deepLink = { action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': 'mmplayer' } }] };
const oldWildcard = { action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [
    { $: { 'android:scheme': 'content' } }, { $: { 'android:mimeType': '*/*' } }, { $: { 'android:pathPattern': '.*\\.mp3' } },
] };
const makeManifest = () => ({ manifest: { application: [{ activity: [
    { $: { 'android:name': '.MainActivity' }, 'intent-filter': [launcher, deepLink, oldWildcard, oldWildcard] },
    { $: { 'android:name': 'OtherActivity' }, 'intent-filter': [launcher] },
], 'activity-alias': [{ $: { 'android:name': 'MainActivitylegend', 'android:targetActivity': '.MainActivity' }, 'intent-filter': [launcher, deepLink, oldWildcard] }] }] } });

it('removes the any-file fallback from the main activity and custom icon aliases', () => {
    const result = restrictAudioFileIntents(makeManifest());
    const app = result.manifest.application[0];
    for (const component of [app.activity[0], app['activity-alias'][0]]) {
        const filters = component['intent-filter'];
        expect(filters).toContain(launcher); expect(filters).toContain(deepLink);
        expect(filters).not.toContain(oldWildcard);
        expect(filters.flatMap((filter: any) => filter.data || []).map((data: any) => data.$['android:mimeType']).filter(Boolean)).toEqual(allowedMimes);
    }
    expect(app.activity[1]['intent-filter']).toEqual([launcher]);
});

it('accepts audio and ZIP files while refusing unrelated MIME types', () => {
    const app = restrictAudioFileIntents(makeManifest()).manifest.application[0];
    const matches = (scheme: string, mime: string) => app.activity[0]['intent-filter'].some((filter: any) => {
        const data = filter.data || [];
        return data.some((item: any) => item.$['android:scheme'] === scheme)
            && data.some((item: any) => item.$['android:mimeType'] === mime || (item.$['android:mimeType'] === 'audio/*' && mime.startsWith('audio/')));
    });
    for (const scheme of ['content', 'file']) {
        for (const mime of ['audio/mpeg', 'audio/flac', 'audio/wav', 'audio/mp4', 'audio/ogg', 'application/ogg', 'application/opus', 'application/zip', 'application/x-zip-compressed']) expect(matches(scheme, mime)).toBe(true);
        for (const mime of ['application/pdf', 'text/plain', 'image/jpeg', 'video/mp4', 'application/octet-stream']) expect(matches(scheme, mime)).toBe(false);
    }
    expect(matches('https', 'audio/mpeg')).toBe(false);
});

it('is idempotent when Android is regenerated repeatedly', () => {
    const result = restrictAudioFileIntents(makeManifest());
    const first = JSON.stringify(result);
    expect(JSON.stringify(restrictAudioFileIntents(result))).toBe(first);
});

it('ships no broad file handler in the actual manifest and keeps the fix enabled for prebuild', async () => {
    const manifest = await AndroidConfig.Manifest.readAndroidManifestAsync(resolve(__dirname, '../../android/app/src/main/AndroidManifest.xml'));
    const app = manifest.manifest.application[0];
    const components = [...app.activity, ...app['activity-alias']];
    const mimes = components.flatMap((component: any) => (component['intent-filter'] || []).flatMap((filter: any) => (filter.data || []).map((data: any) => data.$['android:mimeType']))).filter(Boolean);
    expect(mimes.length).toBeGreaterThan(4);
    expect(mimes.every((mime: string) => allowedMimes.includes(mime))).toBe(true);
    const config = JSON.parse(readFileSync(resolve(__dirname, '../../app.json'), 'utf8'));
    expect(config.expo.plugins).toContain('./plugins/withAudioFileIntents');
});
