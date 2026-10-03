import {
  getItemFadeIn,
  getRowFadeIn,
  getRowStaggerDelay,
  getSectionFadeIn,
  getStaggerDelay,
  getTagFadeIn,
} from '../utils/cascadeAnimations';

describe('cascadeAnimations utility', () => {
  describe('getStaggerDelay', () => {
    it('returns index * staggerMs when index < maxItems', () => {
      expect(getStaggerDelay(0)).toBe(0);
      expect(getStaggerDelay(2, 50, 15)).toBe(100);
      expect(getStaggerDelay(14, 50, 15)).toBe(700);
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

    it('creates FadeIn animation without delay when index >= maxItems', () => {
      const anim = getItemFadeIn(20);
      expect(anim).toBeDefined();
    });
  });

  describe('getRowFadeIn', () => {
    it('creates FadeIn animation with row delay and duration', () => {
      const anim = getRowFadeIn(4, 3);
      expect(anim).toBeDefined();
    });

    it('creates FadeIn animation without delay when index >= maxItems', () => {
      const anim = getRowFadeIn(16, 3);
      expect(anim).toBeDefined();
    });
  });

  describe('getTagFadeIn', () => {
    it('creates FadeIn animation for tags with delay when index < maxItems', () => {
      const anim = getTagFadeIn(3);
      expect(anim).toBeDefined();
    });

    it('creates FadeIn animation without delay when index >= maxItems', () => {
      const anim = getTagFadeIn(30, 40, 25);
      expect(anim).toBeDefined();
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
