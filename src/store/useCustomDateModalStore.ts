import { create } from 'zustand';

interface CustomDateModalState {
  isVisible: boolean;
  initialStartDate: Date | null;
  initialEndDate: Date | null;
  onApply: ((startDate: Date, endDate: Date) => void) | null;
  open: (options: {
    initialStartDate?: Date | null;
    initialEndDate?: Date | null;
    onApply: (startDate: Date, endDate: Date) => void;
  }) => void;
  close: () => void;
}

export const useCustomDateModalStore = create<CustomDateModalState>((set) => ({
  isVisible: false,
  initialStartDate: null,
  initialEndDate: null,
  onApply: null,
  open: ({ initialStartDate, initialEndDate, onApply }) =>
    set({
      isVisible: true,
      initialStartDate: initialStartDate || null,
      initialEndDate: initialEndDate || null,
      onApply,
    }),
  close: () =>
    set({
      isVisible: false,
      initialStartDate: null,
      initialEndDate: null,
      onApply: null,
    }),
}));

export const openCustomDateModal = (options: {
  initialStartDate?: Date | null;
  initialEndDate?: Date | null;
  onApply: (startDate: Date, endDate: Date) => void;
}) => useCustomDateModalStore.getState().open(options);
