// LocalCast is excluded from the desktop port. Shared queue components still
// call this preloader behind their casting-state guard; never load the native
// casting server or Android playback service into the desktop renderer.
export const LocalCastService = {
  async triggerPreloadNext(_index: number) {},
};
