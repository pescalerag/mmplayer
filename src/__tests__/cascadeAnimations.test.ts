import {
  getItemFadeIn,
  createCascadeEntry,
  CASCADE_ANIMATION_CONSTANTS,
  getRowFadeIn,
  getRowStaggerDelay,
  getSectionFadeIn,
  getStaggerDelay,
  getTagFadeIn,
} from '../utils/cascadeAnimations';

jest.mock('react-native-reanimated', () => ({
  Easing: { quad: 'quad', out: (value: string) => `out:${value}` },
  ReduceMotion: { System: 'system' },
  FadeIn: {
    duration: (duration: number) => ({
      delay: (delay: number) => ({
        easing: (easing: string) => ({
          reduceMotion: (reduceMotion: string) => ({ duration, delay, easing, reduceMotion }),
        }),
      }),
    }),
  },
}));

describe('cascadeAnimations utility', () => {
  describe('getStaggerDelay', () => {
    it('returns index * staggerMs when index < maxItems', () => {
      expect(getStaggerDelay(0)).toBe(0);
      expect(getStaggerDelay(2, 50, 15)).toBe(100);
      expect(getStaggerDelay(14, 50, 15)).toBe(240);
    });

    it('returns 0 when index >= maxItems', () => {
      expect(getStaggerDelay(15, 50, 15)).toBe(0);
      expect(getStaggerDelay(20, 50, 15)).toBe(0);
    });
  });

  describe('getRowStaggerDelay', () => {
    it('calculates delay based on row index when index < maxItems', () => {
      // row 0: indices 0, 1, 2
      expect(getRowStaggerDelay(0, 3, 50, 15)).toBe(0);
      expect(getRowStaggerDelay(1, 3, 50, 15)).toBe(0);
      expect(getRowStaggerDelay(2, 3, 50, 15)).toBe(0);

      // row 1: indices 3, 4, 5
      expect(getRowStaggerDelay(3, 3, 50, 15)).toBe(50);
      expect(getRowStaggerDelay(4, 3, 50, 15)).toBe(50);
      expect(getRowStaggerDelay(5, 3, 50, 15)).toBe(50);

      // row 2: indices 6, 7, 8
      expect(getRowStaggerDelay(6, 3, 50, 15)).toBe(100);
    });

    it('returns 0 when index >= maxItems', () => {
      expect(getRowStaggerDelay(15, 3, 50, 15)).toBe(0);
      expect(getRowStaggerDelay(18, 3, 50, 15)).toBe(0);
    });
  });

  describe('getItemFadeIn', () => {
    it('creates FadeIn animation with delay and duration', () => {
      const anim = getItemFadeIn(2);
      expect(anim).toBeDefined();
    });

    it('renders directly when index >= maxItems', () => {
      const anim = getItemFadeIn(20);
      expect(anim).toBeUndefined();
    });
  });

  describe('getRowFadeIn', () => {
    it('creates FadeIn animation with row delay and duration', () => {
      const anim = getRowFadeIn(4, 3);
      expect(anim).toBeDefined();
    });

    it('renders directly when index >= maxItems', () => {
      const anim = getRowFadeIn(16, 3);
      expect(anim).toBeUndefined();
    });
  });

  describe('getTagFadeIn', () => {
    it('creates FadeIn animation for tags with delay when index < maxItems', () => {
      const anim = getTagFadeIn(3);
      expect(anim).toBeDefined();
    });

    it('renders directly when index >= maxItems', () => {
      const anim = getTagFadeIn(30, 40, 25);
      expect(anim).toBeUndefined();
    });
  });

  describe('getSectionFadeIn', () => {
    it('creates FadeIn animation proportional to section index', () => {
      const anim0 = getSectionFadeIn(0);
      const anim2 = getSectionFadeIn(2);
      expect(anim0).toBeDefined();
      expect(anim2).toBeDefined();
    });
  });
});

describe('cascade entry lifetime', () => {
  it('starts when content arrives and stops animating later scroll or refresh mounts', () => {
    let now = 0;
    const entry = createCascadeEntry(() => now);
    now = 5000;
    expect(entry.item(0)).toBeDefined();
    now += CASCADE_ANIMATION_CONSTANTS.ENTRY_WINDOW_MS + 1;
    expect(entry.item(1)).toBeUndefined();
    expect(entry.row(0, 3)).toBeUndefined();
    expect(entry.tag(0)).toBeUndefined();
    expect(entry.section(0)).toBeUndefined();
  });

  it('bounds the whole fade and respects reduced motion', () => {
    expect(getSectionFadeIn(11)).toMatchObject({
      duration: 320, delay: 240, easing: 'out:quad', reduceMotion: 'system',
    });
    expect(getTagFadeIn(11)).toMatchObject({ duration: 320, delay: 240 });
    expect(getRowFadeIn(3, 3)).toMatchObject({ delay: 40 });
    expect(getRowFadeIn(4, 3)).toMatchObject({ delay: 40 });
    expect(getRowFadeIn(5, 3)).toMatchObject({ delay: 40 });
    expect(getItemFadeIn(-1)).toBeUndefined();
    expect(getItemFadeIn(1.5)).toBeUndefined();
    expect(getItemFadeIn(12)).toBeUndefined();
  });
});
