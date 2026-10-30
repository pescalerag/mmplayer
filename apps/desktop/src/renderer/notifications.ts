import { Q } from "@nozbe/watermelondb";
import { database } from "./ports/database";
import { NotificationService } from "../../../../src/services/NotificationService";
import { useNotificationStore } from "../../../../src/store/useNotificationStore";
import { useSettingsStore } from "../../../../src/store/useSettingsStore";

/** Start only after SQLite, settings and language have finished hydrating. */
export function startDesktopNotifications() {
  let active = true, initialized = false, running = false, pending = false;
  const refresh = async () => {
    if (!active) return;
    if (running) { pending = true; return; }
    running = true;
    try {
      do {
        pending = false;
        if (!initialized) {
          // Mobile's update feed targets the Play Store; desktop summaries are local.
          await NotificationService.init({ checkAppUpdates: false });
          initialized = true;
        } else {
          await NotificationService.checkAndGenerateSummaries();
          await NotificationService.getUnreadCount();
        }
      } while (pending && active);
    } catch (error) { console.warn("Desktop notifications could not refresh:", error); }
    finally { running = false; }
  };
  const requestRefresh = () => { void refresh(); };
  const visible = () => { if (document.visibilityState === "visible") requestRefresh(); };
  const unread = database.get("notifications").query(Q.where("is_read", false)).observeCount(false).subscribe({
    next: (count: number) => { if (active) useNotificationStore.getState().setUnreadCount(count); },
    error: (error: unknown) => console.warn("Desktop unread notifications could not refresh:", error),
  });
  const preferences = useSettingsStore.subscribe((next, previous) => {
    if (next.notificationPreferences !== previous.notificationPreferences) requestRefresh();
  });
  window.addEventListener("focus", requestRefresh);
  document.addEventListener("visibilitychange", visible);
  // Generate a newly completed period even if the app stays open overnight.
  const timer = setInterval(visible, 60000);
  requestRefresh();
  return () => {
    active = false;pending = false;clearInterval(timer);unread.unsubscribe();preferences();
    window.removeEventListener("focus", requestRefresh);
    document.removeEventListener("visibilitychange", visible);
  };
}
