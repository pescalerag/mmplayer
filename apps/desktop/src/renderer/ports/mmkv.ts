class DesktopMMKV {
  private prefix: string;
  private memory = new Map<string, string>();

  constructor(config?: { id?: string }) {
    this.prefix = `mmkv:${config?.id || "default"}:`;
  }

  private key(k: string) {
    return `${this.prefix}${k}`;
  }

  getString(k: string): string | undefined {
    try {
      const val = globalThis.localStorage?.getItem(this.key(k));
      if (val !== null && val !== undefined) return val;
    } catch {
      // Fallback to memory
    }
    return this.memory.get(k);
  }

  set(k: string, value: string | number | boolean): void {
    const str = String(value);
    this.memory.set(k, str);
    try {
      globalThis.localStorage?.setItem(this.key(k), str);
    } catch {
      // Ignore storage quota / security errors
    }
  }

  getBoolean(k: string): boolean | undefined {
    const val = this.getString(k);
    if (val === undefined) return undefined;
    return val === "true";
  }

  getNumber(k: string): number | undefined {
    const val = this.getString(k);
    if (val === undefined) return undefined;
    const num = Number(val);
    return Number.isNaN(num) ? undefined : num;
  }

  delete(k: string): void {
    this.memory.delete(k);
    try {
      globalThis.localStorage?.removeItem(this.key(k));
    } catch {
      // Ignore
    }
  }

  remove(k: string): void {
    this.delete(k);
  }

  clearAll(): void {
    this.memory.clear();
    try {
      if (globalThis.localStorage) {
        const keysToRemove: string[] = [];
        for (let i = 0; i < globalThis.localStorage.length; i++) {
          const k = globalThis.localStorage.key(i);
          if (k && k.startsWith(this.prefix)) keysToRemove.push(k);
        }
        keysToRemove.forEach((k) => globalThis.localStorage.removeItem(k));
      }
    } catch {
      // Ignore
    }
  }

  getAllKeys(): string[] {
    const keys = new Set<string>(this.memory.keys());
    try {
      if (globalThis.localStorage) {
        for (let i = 0; i < globalThis.localStorage.length; i++) {
          const k = globalThis.localStorage.key(i);
          if (k && k.startsWith(this.prefix)) {
            keys.add(k.slice(this.prefix.length));
          }
        }
      }
    } catch {
      // Ignore
    }
    return Array.from(keys);
  }
}

export function createMMKV(config?: { id?: string }) {
  return new DesktopMMKV(config);
}

export { DesktopMMKV as MMKV };
