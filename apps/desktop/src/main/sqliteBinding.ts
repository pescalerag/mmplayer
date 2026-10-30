import { DatabaseSync } from "node:sqlite";

/** The small better-sqlite3 surface used by WatermelonDB's Node adapter.
 * Uses Electron's bundled SQLite; no ABI-specific addon or compiler is needed.
 * This adapter runs exclusively in the library worker, never on the UI thread.
 */
export default class SQLiteBinding {
  private db: DatabaseSync;
  open = true;
  readonly memory: boolean;
  constructor(path: string) {
    this.memory = path === ":memory:";
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  }
  prepare(sql: string) {
    const statement = this.db.prepare(sql);
    return {
      run: (args: (string | number | null)[] = []) => statement.run(...args),
      get: (args: (string | number | null)[] = []) => statement.get(...args),
      all: (args: (string | number | null)[] = []) => statement.all(...args),
    };
  }
  exec(sql: string) {
    this.db.exec(sql);
  }
  pragma(sql: string, options?: { simple?: boolean }) {
    const statement = this.db.prepare(`PRAGMA ${sql}`);
    const rows = statement.all();
    return options?.simple ? Object.values(rows[0] ?? {})[0] : rows;
  }
  transaction<T>(block: () => T) {
    return () => {
      this.db.exec("BEGIN IMMEDIATE");
      try {
        const result = block();
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    };
  }
  close() {
    this.db.close();
    this.open = false;
  }
}
