import { createContext, useContext } from "react";
import {
  useUIStore,
  type SheetType,
} from "../../../../../src/store/useUIStore";
import { desktopMenus } from "../desktopMenus";
import type { DesktopMenuEntry } from "../desktopMenuStack";

export const DesktopSheetContext = createContext<DesktopMenuEntry | null>(null);
export function useSheetProps<TProps = any>(type: SheetType) {
  const entry = useContext(DesktopSheetContext);
  const activeSheet = useUIStore((state) =>
    entry ? entry.type : state.activeSheet,
  );
  const sheetProps = useUIStore((state) =>
    entry ? entry.props : state.sheetProps,
  );
  return {
    isVisible: entry ? entry.type === type : activeSheet === type,
    props: (entry?.props ?? sheetProps ?? {}) as TProps,
    close: () => desktopMenus.close(entry?.id),
    openNested: (child: SheetType, props?: any) => {
      desktopMenus.open(child, props);
      return true;
    },
    closeThen: (run: () => void) => {
      desktopMenus.clear();
      run();
    },
  };
}
