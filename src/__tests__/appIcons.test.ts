import { normalizeAppIcon } from '../utils/appIcon';
import { useSettingsStore } from '../store/useSettingsStore';
import fs from 'node:fs';
import path from 'node:path';

const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../../app.json'), 'utf8')).expo;
const icons = config.plugins.find((entry: unknown) =>
    Array.isArray(entry) && entry[0] === '@howincodes/expo-dynamic-app-icon'
)[1];

describe('launcher icon upgrade', () => {
    it.each(['supporter', 'retro', 'darkblue', 'orange'])(
        'keeps the old %s launcher component configured with its new artwork', (legacy) => {
            const replacement = normalizeAppIcon(legacy);
            expect(replacement).not.toBe(legacy);
            expect(icons[legacy]).toEqual(icons[replacement]);
            useSettingsStore.getState().setAppIcon(legacy);
            expect(useSettingsStore.getState().appIcon).toBe(replacement);
        }
    );

    it('uses adaptive layers and existing assets for every selectable and legacy alias', () => {
        for (const icon of Object.values(icons) as { android: { foregroundImage: string; backgroundColor: string }; ios: string }[]) {
            expect(typeof icon.android).toBe('object');
            expect(icon.android.backgroundColor).toMatch(/^#[0-9a-f]{6}$/i);
            expect(fs.existsSync(path.resolve(__dirname, '../..', icon.android.foregroundImage))).toBe(true);
            expect(fs.existsSync(path.resolve(__dirname, '../..', icon.ios))).toBe(true);
        }
        expect(config.plugins).toContain('./plugins/withAdaptiveIconFallbacks');
    });

    it('keeps current choices unchanged', () => {
        for (const name of ['DEFAULT', 'dark', 'aqua', 'develpink', 'labgreen', 'pink', 'red', 'white', 'yellow', 'legend']) {
            expect(normalizeAppIcon(name)).toBe(name);
        }
    });

    it('keeps the legendary icon distinct from the generic gold variant', () => {
        expect(icons.legend.android.foregroundImage).toContain('logoLegend.png');
        expect(icons.legend).not.toEqual(icons.yellow);
        useSettingsStore.getState().setAppIcon('legend');
        expect(useSettingsStore.getState().appIcon).toBe('legend');
    });
});
