import { parentPort, workerData } from "node:worker_threads";
import { DesktopLibrary } from "./library";

const library = new DesktopLibrary(workerData.directory, (event, data) =>
  parentPort!.postMessage({ event, data }),
);
let pending = Promise.resolve();
parentPort!.on(
  "message",
  (message: { id: number; command: string; input?: unknown }) => {
    // Audio range requests must not wait behind an entire library scan.
    if (message.command === "cancelMetadata") {
      const batchId = (message.input as { batchId?: unknown } | undefined)
        ?.batchId;
      if (typeof batchId !== "string") {
        parentPort!.postMessage({
          id: message.id,
          error: "Invalid metadata batch",
        });
        return;
      }
      library.cancelMetadata(batchId);
      parentPort!.postMessage({ id: message.id });
      return;
    }
    if (message.command === "media") {
      const input = message.input as {
        id: string;
        kind: "track" | "cover" | "asset";
      };
      void library.mediaPath(input.id, input.kind).then(
        (value) => parentPort!.postMessage({ id: message.id, value }),
        (error) =>
          parentPort!.postMessage({ id: message.id, error: String(error) }),
      );
      return;
    }
    pending = pending.then(async () => {
      try {
        let value: unknown;
        if (message.command === "initialize")
          value = await library.initialize(message.input as string | undefined);
        else if (message.command === "language") {
          await library.initialize(message.input as string);
          parentPort!.postMessage({ event: "library" });
        } else if (message.command === "database")
          value = await library.databaseRequest(message.input as never);
        else if (message.command === "library")
          value = await library.snapshot();
        else if (message.command === "repairCollaborators") value = await library.repairCollaborators();
        else if (message.command === "scan") value = await library.scan();
        else if (message.command === "trackExportPath")
          value = await library.trackExportPath(message.input as string);
        else if (message.command === "readMetadata")
          value = await library.readMetadata(
            (message.input as { uri: string }).uri,
          );
        else if (message.command === "readReplayGain")
          value = await library.readReplayGain(
            (message.input as { uri: string }).uri,
          );
        else if (message.command === "writeMetadata") {
          const input =
            message.input as import("@mmplayer/platform").DesktopCommands["writeMetadata"]["input"];
          value = Array.isArray(input)
            ? await library.writeMetadata(input)
            : await library.writeMetadata(input.items, input.batchId);
        } else if (message.command === "fileSystem")
          value = await library.fileSystemRequest(
            message.input as import("@mmplayer/platform").DesktopCommands["fileSystem"]["input"],
          );
        else if (message.command === "importMusicZip")
          value = await library.importMusicZip(message.input as never);
        else if (message.command === "importPaths")
          value = await library.importPaths(message.input as string[]);
        else if (message.command === "addRoots")
          value = await library.addRoots(message.input as string[]);
        else if (message.command === "excludeFolders")
          value = await library.excludeFolders(message.input as string[]);
        else if (message.command === "excludeSongs")
          value = await library.excludeSongs(message.input as string[]);
        else
          value = await library.mutate(
            message.command,
            message.input as Record<string, unknown>,
          );
        parentPort!.postMessage({ id: message.id, value });
      } catch (error) {
        parentPort!.postMessage({
          id: message.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  },
);
