import React from 'react';

/** Execute effects/cleanup and rerenders without replacing the hook under test. */
export function createHookHarness() {
    const states: any[] = [], refs: any[] = [];
    const callbacks: { deps?: React.DependencyList; value: any }[] = [];
    const effects: { deps?: React.DependencyList; cleanup?: () => void }[] = [];
    let stateIndex = 0, refIndex = 0, callbackIndex = 0, effectIndex = 0;
    let pending: (() => void)[] = [];
    let stateUpdates = 0;
    const changed = (a?: React.DependencyList, b?: React.DependencyList) => !a || !b || a.length !== b.length || a.some((value, i) => !Object.is(value, b[i]));
    jest.spyOn(React, 'useState').mockImplementation(((initial: any) => {
        const i = stateIndex++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], (value: any) => { stateUpdates++; states[i] = typeof value === 'function' ? value(states[i]) : value; }];
    }) as any);
    jest.spyOn(React, 'useRef').mockImplementation(((initial: any) => { const i = refIndex++; return refs[i] ??= { current: initial }; }) as any);
    jest.spyOn(React, 'useCallback').mockImplementation((callback, deps) => {
        const i = callbackIndex++;
        if (changed(callbacks[i]?.deps, deps)) callbacks[i] = { deps, value: callback };
        return callbacks[i].value;
    });
    jest.spyOn(React, 'useMemo').mockImplementation((factory, deps) => {
        const i = callbackIndex++;
        if (changed(callbacks[i]?.deps, deps)) callbacks[i] = { deps, value: factory() };
        return callbacks[i].value;
    });
    jest.spyOn(React, 'useEffect').mockImplementation((effect, deps) => {
        const i = effectIndex++, previous = effects[i];
        if (changed(previous?.deps, deps)) pending.push(() => { previous?.cleanup?.(); effects[i] = { deps, cleanup: effect() || undefined }; });
    });
    return {
        get stateUpdates() { return stateUpdates; },
        render<T>(hook: () => T): T {
            stateIndex = refIndex = callbackIndex = effectIndex = 0;
            pending = [];
            const value = hook(); pending.forEach(run => run()); return value;
        },
        dispose() { effects.forEach(effect => effect.cleanup?.()); },
    };
}
