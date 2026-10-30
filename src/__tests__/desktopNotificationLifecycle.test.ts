import { startDesktopNotifications } from '../../apps/desktop/src/renderer/notifications';
import { database } from '../../apps/desktop/src/renderer/ports/database';
import { NotificationService } from '../services/NotificationService';
import { useSettingsStore } from '../store/useSettingsStore';
import { useNotificationStore } from '../store/useNotificationStore';

jest.mock('../../apps/desktop/src/renderer/ports/database',()=>({database:{get:jest.fn()}}));
jest.mock('../services/NotificationService',()=>({NotificationService:{init:jest.fn(),checkAndGenerateSummaries:jest.fn(),getUnreadCount:jest.fn()}}));
let stop: (()=>void)|undefined,oldWindow:any,oldDocument:any,notify:any;
const unsubscribe=jest.fn();
beforeEach(()=>{
  jest.useFakeTimers();jest.clearAllMocks();oldWindow=(globalThis as any).window;oldDocument=(globalThis as any).document;
  (globalThis as any).window=new EventTarget();(globalThis as any).document=Object.assign(new EventTarget(),{visibilityState:'visible'});
  (database.get as jest.Mock).mockReturnValue({query:()=>({observeCount:()=>({subscribe:(observer:any)=>{notify=observer.next;return{unsubscribe};}})})});
  (NotificationService.init as jest.Mock).mockResolvedValue(undefined);(NotificationService.checkAndGenerateSummaries as jest.Mock).mockResolvedValue(undefined);(NotificationService.getUnreadCount as jest.Mock).mockResolvedValue(0);
});
afterEach(()=>{stop?.();stop=undefined;(globalThis as any).window=oldWindow;(globalThis as any).document=oldDocument;jest.useRealTimers();});
it('initializes local notifications and reacts to focus, visibility, preferences and a minute passing',async()=>{
  stop=startDesktopNotifications();await jest.advanceTimersByTimeAsync(0);
  expect(NotificationService.init).toHaveBeenCalledWith({checkAppUpdates:false});notify(7);expect(useNotificationStore.getState().unreadCount).toBe(7);
  window.dispatchEvent(new Event('focus'));await jest.advanceTimersByTimeAsync(0);expect(NotificationService.checkAndGenerateSummaries).toHaveBeenCalledTimes(1);
  document.dispatchEvent(new Event('visibilitychange'));await jest.advanceTimersByTimeAsync(0);expect(NotificationService.checkAndGenerateSummaries).toHaveBeenCalledTimes(2);
  useSettingsStore.setState({notificationPreferences:{...useSettingsStore.getState().notificationPreferences,summary_weekly:false}});await jest.advanceTimersByTimeAsync(0);expect(NotificationService.checkAndGenerateSummaries).toHaveBeenCalledTimes(3);
  await jest.advanceTimersByTimeAsync(60000);expect(NotificationService.checkAndGenerateSummaries).toHaveBeenCalledTimes(4);
  (document as any).visibilityState='hidden';await jest.advanceTimersByTimeAsync(60000);expect(NotificationService.checkAndGenerateSummaries).toHaveBeenCalledTimes(4);
  stop();expect(unsubscribe).toHaveBeenCalled();window.dispatchEvent(new Event('focus'));await jest.advanceTimersByTimeAsync(60000);expect(NotificationService.checkAndGenerateSummaries).toHaveBeenCalledTimes(4);
});
it('coalesces repeated triggers while a refresh is running',async()=>{
  stop=startDesktopNotifications();await jest.advanceTimersByTimeAsync(0);
  let complete!:()=>void;(NotificationService.checkAndGenerateSummaries as jest.Mock).mockImplementationOnce(()=>new Promise<void>(resolve=>{complete=resolve;}));
  for(let i=0;i<10;i++)window.dispatchEvent(new Event('focus'));
  expect(NotificationService.checkAndGenerateSummaries).toHaveBeenCalledTimes(1);complete();await jest.advanceTimersByTimeAsync(0);
  expect(NotificationService.checkAndGenerateSummaries).toHaveBeenCalledTimes(2);expect(NotificationService.init).toHaveBeenCalledTimes(1);
});
