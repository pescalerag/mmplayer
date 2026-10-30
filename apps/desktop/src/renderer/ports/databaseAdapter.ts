import { createLibraryDatabase, mySchema, myMigrations } from "@mmplayer/data";
import type { DatabaseAdapter } from "@nozbe/watermelondb/adapters/type";
import type { DesktopBridge } from "@mmplayer/platform";

/** Only the adapter is desktop-specific. Screens retain their original models and observables. */
export function createDesktopDatabase(bridge: DesktopBridge) {
  const cached = new Map<string, Set<string>>();
  const mark = (table: string, raw: any) => {
    if (!raw) return null;
    let ids = cached.get(table);
    if (!ids) {
      ids = new Set();
      cached.set(table, ids);
    }
    if (ids.has(raw.id)) return raw.id;
    ids.add(raw.id);
    return raw;
  };
  const adapter = new Proxy(
    { schema: mySchema, migrations: myMigrations, dbName: "desktop-worker" },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        if (property === "then") return undefined;
        return (...values: any[]) => {
          const callback = values.pop();
          void bridge
            .invoke("database", { method: String(property), args: values })
            .then(
              (result) => {
                if (property === "find") result = mark(values[0], result);
                if (property === "query")
                  result = (result as any[]).map((raw) =>
                    mark(values[0].table, raw),
                  );
                if (property === "batch")
                  for (const [kind, table, value] of values[0]) {
                    if (kind === "create") mark(table, value);
                    if (
                      kind === "destroyPermanently" ||
                      kind === "markAsDeleted"
                    )
                      cached.get(table)?.delete(value);
                  }
                callback({ value: result });
              },
              (error) => callback({ error }),
            );
        };
      },
    },
  ) as unknown as DatabaseAdapter;
  const database = createLibraryDatabase(adapter);
  // WatermelonDB's change delivery is synchronous after the worker commits. Apply
  // all raw values before notifying queries, just as Database.batch does locally.
  const dispose = bridge.on("database", (event) => {
    if (event.source === "renderer") return;
    const collection = database.get(event.table) as any;
    const changes = event.changes.map(({ type, raw }) => {
      const existing = collection._cache.get(raw.id);
      const record = existing || collection._cache.recordFromQueryResult(raw);
      record._raw = raw;
      mark(event.table, raw);
      if (type === "destroyed") cached.get(event.table)?.delete(raw.id);
      return { record, type };
    });
    collection._applyChangesToCache(changes);
    (database as any)._notify([[event.table, changes]]);
  });
  return { database, dispose };
}
