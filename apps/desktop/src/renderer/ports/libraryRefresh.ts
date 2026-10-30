let pending: Promise<unknown> | undefined;
const refresh = () =>
  (pending ??= window.mmplayer.invoke("scan", undefined).finally(() => {
    pending = undefined;
  }));
export const LibraryRefreshService = { refresh, startup: refresh };
