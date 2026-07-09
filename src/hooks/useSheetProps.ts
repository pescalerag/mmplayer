import { useRef } from 'react';
import { useUIStore, SheetType } from '../store/useUIStore';

export function useSheetProps<TProps = any>(type: SheetType) {
    const activeSheet = useUIStore(state => state.activeSheet);
    const sheetProps = useUIStore(state => state.sheetProps);
    const closeSheet = useUIStore(state => state.closeSheet);

    const isVisible = activeSheet === type;
    
    // Store the last valid props in a ref so they persist during closing animation
    const lastPropsRef = useRef<any>({});
    if (isVisible && sheetProps) {
        lastPropsRef.current = sheetProps;
    }

    return {
        isVisible,
        props: (isVisible ? sheetProps : lastPropsRef.current) as TProps,
        close: closeSheet,
    };
}
