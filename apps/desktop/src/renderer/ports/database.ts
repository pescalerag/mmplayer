import { createDesktopDatabase } from "./databaseAdapter";
import type { DesktopBridge, DesktopEvents } from "@mmplayer/platform";
export { createDesktopDatabase } from "./databaseAdapter";

const eventListeners = new Map<
  keyof DesktopEvents,
  Set<(data: any) => void>
>();
let attachedMmplayer: any = null;
let attachedOn: any = null;
let stopAttached = () => {};

function ensureEventSubscription(mmplayer: any) {
  const currentOn = mmplayer?.on;
  if (!currentOn || (mmplayer === attachedMmplayer && currentOn === attachedOn))
    return;
  stopAttached();
  attachedMmplayer = mmplayer;
  attachedOn = currentOn;
  const stops: Array<() => void> = [];
  for (const [event, listeners] of eventListeners.entries()) {
    const unsub = currentOn.call(mmplayer, event, (data: any) => {
      listeners.forEach((cb) => cb(data));
    });
    if (typeof unsub === "function") stops.push(unsub);
  }
  stopAttached = () => {
    stops.forEach((fn) => fn());
  };
}

const dynamicBridge = new Proxy({} as DesktopBridge, {
  get(_target, prop) {
    const current = (globalThis as any).window?.mmplayer;
    if (prop === "on") {
      return <K extends keyof DesktopEvents>(
        event: K,
        listener: (data: DesktopEvents[K]) => void,
      ) => {
        let set = eventListeners.get(event);
        if (!set) {
          set = new Set();
          eventListeners.set(event, set);
          if (attachedMmplayer?.on) {
            const unsub = attachedMmplayer.on(event, (data: any) => {
              set!.forEach((cb) => cb(data));
            });
            const prevStop = stopAttached;
            stopAttached = () => {
              prevStop();
              if (typeof unsub === "function") unsub();
            };
          }
        }
        set.add(listener);
        ensureEventSubscription(current);
        return () => {
          set?.delete(listener);
        };
      };
    }
    if (prop === "invoke") {
      return (command: any, input: any) => {
        const mm = (globalThis as any).window?.mmplayer;
        ensureEventSubscription(mm);
        return mm.invoke(command, input);
      };
    }
    const val = current?.[prop];
    return typeof val === "function" ? val.bind(current) : val;
  },
});

export const database = createDesktopDatabase(dynamicBridge).database;
