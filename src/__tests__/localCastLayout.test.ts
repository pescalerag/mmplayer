import { runInNewContext } from 'node:vm';
import { createLocalCastLayoutView } from '../services/LocalCastView';
import { localCastLayoutSource } from '../services/generated/LocalCastViewSource';

describe.each(['source', 'browser'])('LocalCast automatic artwork sizing (%s)', implementation => {
    it('fits real metadata and controls, updates on resize and avoids observer loops', () => {
        const artwork = { style: { width: '', height: '' } };
        const info = { getBoundingClientRect: () => ({ height: 170 }) };
        const controls = { getBoundingClientRect: () => ({ height: 145 }) };
        const column = { children: [artwork, info, controls], clientHeight: 580, clientWidth: 400 };
        let callback: (() => void) | undefined;
        let scheduled: (() => void) | undefined;
        const disconnect = jest.fn();
        const removeEventListener = jest.fn();
        const environment = {
            getComputedStyle: () => ({ rowGap: '10px' }),
            ResizeObserver: class { constructor(cb: () => void) { callback = cb; } observe() {} disconnect = disconnect; },
            requestAnimationFrame: jest.fn((cb: () => void) => { scheduled = cb; return 1; }),
            cancelAnimationFrame: jest.fn(),
            window: { addEventListener: jest.fn(), removeEventListener },
        };
        Object.assign(globalThis, environment);
        try {
            const create: typeof createLocalCastLayoutView = implementation === 'source' ? createLocalCastLayoutView : runInNewContext(`(${localCastLayoutSource})`, environment);
            const view = create(column as unknown as HTMLElement, artwork as unknown as HTMLElement);
            scheduled!();
            expect(artwork.style).toEqual({ width: '245px', height: '245px' });
            column.clientHeight = 1000;
            callback!(); callback!();
            expect(environment.requestAnimationFrame).toHaveBeenCalledTimes(2);
            scheduled!();
            expect(artwork.style.width).toBe('320px');
            column.clientWidth = 210;
            callback!(); scheduled!();
            expect(artwork.style.width).toBe('210px');
            view.dispose();
            expect(disconnect).toHaveBeenCalledTimes(1);
            expect(removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function));
        } finally { for (const key of Object.keys(environment)) Reflect.deleteProperty(globalThis, key); }
    });
});
