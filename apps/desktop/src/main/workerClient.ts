import { Worker } from "node:worker_threads";
export class LibraryWorkerClient {
  private worker: Worker;
  private sequence = 0;
  private pending = new Map<
    number,
    { resolve: (data: any) => void; reject: (error: Error) => void }
  >();
  constructor(
    path: string,
    directory: string,
    event: (event: string, data: unknown) => void,
  ) {
    this.worker = new Worker(path, { workerData: { directory } });
    this.worker.on("message", (message) => {
      if (message.event) {
        event(message.event, message.data);
        return;
      }
      const request = this.pending.get(message.id);
      if (!request) return;
      this.pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error));
      else request.resolve(message.value);
    });
    const fail = (error: Error) => {
      this.pending.forEach((request) => request.reject(error));
      this.pending.clear();
      event("error", error.message);
    };
    this.worker.on("error", fail);
    this.worker.on("exit", (code) => {
      if (code !== 0) fail(new Error(`Library worker stopped (${code})`));
    });
  }
  request<T = unknown>(command: string, input?: unknown): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, command, input });
    });
  }
  close() {
    this.pending.forEach((request) =>
      request.reject(new Error("Application closed")),
    );
    this.pending.clear();
    return this.worker.terminate();
  }
}
