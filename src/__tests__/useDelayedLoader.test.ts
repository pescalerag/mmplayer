import React from 'react';
import { useDelayedLoader } from '../hooks/useDelayedLoader';
import { DelayedLoaderController } from '../utils/delayedLoader';

jest.mock('../utils/delayedLoader');

describe('useDelayedLoader hook', () => {
  let mockController: {
    startLoading: jest.Mock;
    stopLoading: jest.Mock;
    destroy: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockController = {
      startLoading: jest.fn(),
      stopLoading: jest.fn(),
      destroy: jest.fn(),
    };
    (DelayedLoaderController as unknown as jest.Mock).mockImplementation(() => mockController);
  });

  it('manages lifecycle, loading start, and loading stop', () => {
    const effects: { cb: () => void | (() => void); deps?: React.DependencyList }[] = [];
    let stateVal = false;
    const setState = jest.fn((val) => {
      stateVal = val;
    });
    const ref = { current: null };

    jest.spyOn(React, 'useState').mockReturnValue([stateVal, setState]);
    jest.spyOn(React, 'useRef').mockReturnValue(ref);
    jest.spyOn(React, 'useEffect').mockImplementation((cb, deps) => {
      effects.push({ cb, deps });
    });

    // 1. Initial render with isLoading = true
    const result1 = useDelayedLoader(true, { delay: 100 });
    expect(result1).toBe(false);
    expect(DelayedLoaderController).toHaveBeenCalledWith(setState, { delay: 100 });

    // Execute effect for isLoading
    const loadingEffect = effects.find((e) => e.deps && e.deps[0] === true);
    loadingEffect?.cb();
    expect(mockController.startLoading).toHaveBeenCalled();

    // 2. Render with isLoading = false
    effects.length = 0;
    useDelayedLoader(false);
    const stopEffect = effects.find((e) => e.deps && e.deps[0] === false);
    stopEffect?.cb();
    expect(mockController.stopLoading).toHaveBeenCalled();

    // 3. Unmount cleanup effect
    const unmountEffect = effects.find((e) => e.deps && e.deps.length === 0);
    const cleanup = unmountEffect?.cb();
    if (typeof cleanup === 'function') {
      cleanup();
    }
    expect(mockController.destroy).toHaveBeenCalled();
  });
});
