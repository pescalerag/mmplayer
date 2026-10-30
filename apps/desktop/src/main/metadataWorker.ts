import { parentPort } from "node:worker_threads";
import { writeFileMetadata } from "./metadataWriter";

parentPort!.on("message", async ({ path, metadata }) => {
  try {
    await writeFileMetadata(path, metadata);
    parentPort!.postMessage({ success: true });
  } catch (error) {
    parentPort!.postMessage({
      success: false,
      errorCode: ["EACCES", "EPERM", "EROFS"].includes(
        (error as NodeJS.ErrnoException).code ?? "",
      )
        ? "permission"
        : undefined,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
