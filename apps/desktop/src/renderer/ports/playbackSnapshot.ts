import { create } from "zustand";
import { player } from "../player";
export const usePlaybackSnapshotStore = create<any>(() => ({
  trackId: null,
  artwork: null,
  track: null,
}));
player.subscribe(() => {
  const track = player.getSnapshot().track;
  if (usePlaybackSnapshotStore.getState().trackId !== track?.id)
    usePlaybackSnapshotStore.setState({
      trackId: track?.id ?? null,
      artwork: track?.cover ?? null,
      track,
    });
});
