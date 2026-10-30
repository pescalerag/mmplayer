import { useRef } from 'react';
import { useUIStore, SheetType } from '../store/useUIStore';
import { sheetTransition } from '../utils/sheetTransition';
import { navigationRef } from '../navigation/navigationRef';

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
        // Desktop can keep the current content mounted beside a child menu.
        openNested: (_type: SheetType, _props?: any): boolean => false,
        closeThen: (run: () => void) => {
            if (useUIStore.getState().activeSheet !== type) return;
            const originKey = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.key : undefined;
            sheetTransition.request(type, closeSheet, () => {
                if (!originKey || navigationRef.getCurrentRoute()?.key === originKey) run();
            });
        },
    };
}
