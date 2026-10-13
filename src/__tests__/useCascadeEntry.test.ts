import React from 'react';
import { useCascadeEntry } from '../hooks/useCascadeEntry';
import { createCascadeEntry } from '../utils/cascadeAnimations';

jest.mock('../utils/cascadeAnimations', () => ({ createCascadeEntry: jest.fn(() => ({})) }));

it('retains the animation entry across rerenders and creates one only when the content key changes', () => {
  const refs: { current: unknown }[] = []; let cursor = 0;
  jest.spyOn(React, 'useRef').mockImplementation(value => {
    const index = cursor++;
    refs[index] ??= { current: value };
    return refs[index] as any;
  });
  const render = (key?: unknown) => { cursor = 0; return useCascadeEntry(key); };
  try {
    const first = render();
    expect(render()).toBe(first);
    const next = render('new-album');
    expect(next).not.toBe(first);
    expect(render('new-album')).toBe(next);
    expect(createCascadeEntry).toHaveBeenCalledTimes(2);
  } finally { jest.restoreAllMocks(); }
});
