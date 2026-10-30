import { create } from "zustand";
import { player } from "../player";

let timer: ReturnType<typeof setTimeout> | undefined;
let countdownInterval: ReturnType<typeof setInterval> | undefined;

function clearTimers() {
  if (timer) clearTimeout(timer);
  if (countdownInterval) clearInterval(countdownInterval);
  timer = undefined;
  countdownInterval = undefined;
}

export const useSleepTimerStore = create<any>((set) => ({
  isActive: false,
  timeLeft: 0,
  startTimer: (minutes: number) => {
    clearTimers();
    const endAt = Date.now() + minutes * 60000;
    set({ isActive: true, timeLeft: minutes * 60 });
    countdownInterval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      set({ timeLeft: remaining });
      if (remaining <= 0) {
        clearTimers();
        player.pause();
        set({ isActive: false, timeLeft: 0 });
      }
    }, 1000);
    timer = setTimeout(() => {
      clearTimers();
      player.pause();
      set({ isActive: false, timeLeft: 0 });
    }, minutes * 60000);
  },
  deactivate: () => {
    clearTimers();
    set({ isActive: false, timeLeft: 0 });
  },
}));
