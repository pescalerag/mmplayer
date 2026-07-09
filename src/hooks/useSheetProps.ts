import { useUIStore, SheetType } from '../store/useUIStore';

export function useSheetProps<TProps = any>(type: SheetType) {
    const activeSheet = useUIStore(state => state.activeSheet);
    const sheetProps = useUIStore(state => state.sheetProps);
    const closeSheet = useUIStore(state => state.closeSheet);

    const isVisible = activeSheet === type;
    return {
        isVisible,
        props: (isVisible ? sheetProps : {}) as TProps,
        close: closeSheet,
    };
}
