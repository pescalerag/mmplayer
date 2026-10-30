import type { OverlayAnchor } from "../../../../packages/core/src/overlayPosition";

export interface DesktopMenuEntry {
  id: number;
  type: string;
  props: any;
  anchor: OverlayAnchor & { offsetY?: number; point?: boolean };
  parentId?: number;
}

/** Presentation state only: shared sheets still own their actions and data. */
export class DesktopMenuStack {
  private entries: DesktopMenuEntry[] = [];
  private listeners = new Set<() => void>();
  private nextId = 0;
  private closeRevision = 0;
  private origin?: { parentId?: number; anchor: DesktopMenuEntry["anchor"] };
  constructor(
    private readonly publish: (entry?: DesktopMenuEntry) => void = () => {},
  ) {}
  getSnapshot = () => this.entries;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  interaction(anchor: DesktopMenuEntry["anchor"], parentId?: number) {
    this.origin = { anchor, parentId };
  }
  retain = () => {
    ++this.closeRevision;
  };
  open(type: string, props: any = {}) {
    ++this.closeRevision;
    const parentIndex = this.entries.findIndex(
      (entry) => entry.id === this.origin?.parentId,
    );
    const parents =
      parentIndex < 0 ? [] : this.entries.slice(0, parentIndex + 1);
    const anchor = this.origin?.anchor ?? { x: 24, y: 48, width: 0, height: 0 };
    const entry = {
      id: ++this.nextId,
      type,
      props,
      anchor,
      parentId: parents.at(-1)?.id,
    };
    this.set([...parents, entry]);
  }
  /** Mobile actions close immediately before opening their child. Commit the
   * dismissal after the synchronous action, without unmounting the parent. */
  close = (id = this.entries.at(-1)?.id) => {
    const revision = ++this.closeRevision;
    queueMicrotask(() => {
      if (revision !== this.closeRevision) return;
      const index = this.entries.findIndex((entry) => entry.id === id);
      if (index >= 0) this.set(this.entries.slice(0, index));
    });
  };
  clear = () => {
    ++this.closeRevision;
    this.origin = undefined;
    this.set([]);
  };
  private set(entries: DesktopMenuEntry[]) {
    this.entries = entries;
    this.publish(entries.at(-1));
    this.listeners.forEach((listener) => listener());
  }
}
