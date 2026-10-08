import { InteractionManager } from 'react-native';
import { scheduleScreenRefresh } from '../utils/scheduleScreenRefresh';

jest.mock('react-native', () => ({ InteractionManager: { runAfterInteractions: jest.fn() } }));

describe('screen refresh scheduling', () => {
    let frames: Map<number, FrameRequestCallback>;
    let afterInteractions: () => void;
    let cancel: jest.Mock;
    const originalRequest = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;

    const paintFrame = () => {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach(callback => callback(0));
    };

    beforeEach(() => {
        frames = new Map();
        let id = 0;
        globalThis.requestAnimationFrame = jest.fn(callback => {
            frames.set(++id, callback);
            return id;
        });
        globalThis.cancelAnimationFrame = jest.fn(frame => { frames.delete(frame); });
        cancel = jest.fn();
        (InteractionManager.runAfterInteractions as jest.Mock).mockImplementation(callback => {
            afterInteractions = callback;
            return { cancel };
        });
    });

    afterEach(() => {
        jest.clearAllMocks();
        globalThis.requestAnimationFrame = originalRequest;
        globalThis.cancelAnimationFrame = originalCancel;
    });

    it('allows the screen to paint and finish interactions before starting queries', () => {
        const refresh = jest.fn();
        const dispose = scheduleScreenRefresh(refresh);
        expect(refresh).not.toHaveBeenCalled();
        paintFrame();
        expect(InteractionManager.runAfterInteractions).not.toHaveBeenCalled();
        paintFrame();
        expect(refresh).not.toHaveBeenCalled();
        afterInteractions();
        expect(refresh).toHaveBeenCalledTimes(1);
        dispose();
    });

    it('cancels work when the screen loses focus before painting', () => {
        const refresh = jest.fn();
        const dispose = scheduleScreenRefresh(refresh);
        dispose();
        paintFrame();
        paintFrame();
        expect(refresh).not.toHaveBeenCalled();
        expect(InteractionManager.runAfterInteractions).not.toHaveBeenCalled();
    });

    it('ignores even a queued interaction callback after navigating away', () => {
        const refresh = jest.fn();
        const dispose = scheduleScreenRefresh(refresh);
        paintFrame();
        paintFrame();
        dispose();
        afterInteractions();
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(refresh).not.toHaveBeenCalled();
    });
});
