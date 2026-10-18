import { runInNewContext } from 'node:vm';
import { createLocalCastSettingsView } from '../services/LocalCastView';
import { localCastSettingsSource } from '../services/generated/LocalCastViewSource';

class Checkbox {
    checked = false;
    disabled = true;
    change = () => {};
    addEventListener(_event: string, handler: () => void) { this.change = handler; }
}
const browser: typeof createLocalCastSettingsView = runInNewContext(`(${localCastSettingsSource})`);
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe.each([['source', createLocalCastSettingsView], ['browser', browser]] as const)('LocalCast settings (%s)', (_name, create) => {
    function setup(save = jest.fn().mockResolvedValue(true)) {
        const controls = { replayGainEnabled: new Checkbox(), hideRatings: new Checkbox(), hideTags: new Checkbox() };
        const status = { textContent: '' };
        const visibility = jest.fn();
        const view = create(controls as unknown as Parameters<typeof create>[0], status as HTMLElement, 'Failed', save, visibility);
        view.sync({ localCastSettings: { sessionId: 'current', replayGainEnabled: true, hideRatings: false, hideTags: false } });
        return { controls, status, visibility, view, save };
    }
    it.each(['replayGainEnabled', 'hideRatings', 'hideTags'] as const)('saves %s for the current session and applies the confirmed value', async key => {
        const { controls, save, visibility } = setup();
        const desired = !controls[key].checked;
        save.mockResolvedValue(desired);
        controls[key].checked = desired; controls[key].change();
        expect(save).toHaveBeenCalledWith(key, desired, 'current');
        expect(Object.values(controls).every(control => control.disabled)).toBe(true);
        await flush();
        expect(controls[key].checked).toBe(desired);
        expect(controls[key].disabled).toBe(false);
        expect(visibility).toHaveBeenLastCalledWith(key === 'hideRatings', key === 'hideTags');
    });
    it('restores the last authoritative choice on a failed save', async () => {
        const { controls, status, visibility } = setup(jest.fn().mockRejectedValue(new Error('Disconnected')));
        controls.hideTags.checked = true; controls.hideTags.change();
        await flush();
        expect(controls.hideTags.checked).toBe(false);
        expect(controls.hideTags.disabled).toBe(false);
        expect(status.textContent).toBe('Failed');
        expect(visibility).toHaveBeenLastCalledWith(false, false);
    });
    it('does not overwrite a pending edit with an older poll and follows later external updates', async () => {
        let confirm!: (enabled: boolean) => void;
        const { controls, view, visibility } = setup(jest.fn(() => new Promise<boolean>(resolve => { confirm = resolve; })));
        controls.hideTags.checked = true; controls.hideTags.change();
        view.sync({ localCastSettings: { sessionId: 'current', replayGainEnabled: true, hideRatings: false, hideTags: false } });
        confirm(true); await flush();
        expect(controls.hideTags.checked).toBe(true);
        view.sync({ localCastSettings: { sessionId: 'next', replayGainEnabled: false, hideRatings: true, hideTags: false } });
        expect(visibility).toHaveBeenLastCalledWith(true, false);
        expect(controls.replayGainEnabled.checked).toBe(false);
    });
});
