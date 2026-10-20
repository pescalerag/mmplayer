import { create } from 'zustand';

interface CustomDateModalState {
  restrictToHistory: boolean;
  isVisible: boolean;
  initialStartDate: Date | null;
  initialEndDate: Date | null;
  onApply: ((startDate: Date, endDate: Date) => void) | null;
  open: (options: {
    restrictToHistory?: boolean;
    initialStartDate?: Date | null;
    initialEndDate?: Date | null;
    onApply: (startDate: Date, endDate: Date) => void;
  }) => void;
  close: () => void;
}

export const useCustomDateModalStore = create<CustomDateModalState>((set) => ({
  restrictToHistory: true,
  isVisible: false,
  initialStartDate: null,
  initialEndDate: null,
  onApply: null,
  open: ({ initialStartDate, initialEndDate, onApply, restrictToHistory = true }) =>
    set({
      restrictToHistory,
      isVisible: true,
      initialStartDate: initialStartDate || null,
      initialEndDate: initialEndDate || null,
      onApply,
    }),
  close: () =>
    set({
      restrictToHistory: true,
      isVisible: false,
      initialStartDate: null,
      initialEndDate: null,
      onApply: null,
    }),
}));

export const openCustomDateModal = (options: {
  restrictToHistory?: boolean;
  initialStartDate?: Date | null;
  initialEndDate?: Date | null;
  onApply: (startDate: Date, endDate: Date) => void;
}) => useCustomDateModalStore.getState().open(options);
