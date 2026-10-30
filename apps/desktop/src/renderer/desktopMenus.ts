import { useUIStore, type SheetType } from "../../../../src/store/useUIStore";
import { DesktopMenuStack } from "./desktopMenuStack";
import { useTagFormStore } from "../../../../src/store/useTagFormStore";
import { useColorPickerModalStore } from "../../../../src/store/useColorPickerModalStore";

const original = useUIStore.getState();
export const desktopMenus = new DesktopMenuStack((entry) => {
  if (entry) original.openSheet(entry.type as SheetType, entry.props);
  else original.closeSheet();
});

// Only loaded by Electron. Android keeps its single-sheet store and lifecycle.
useUIStore.setState({
  openSheet: (type, props) => desktopMenus.open(type, props),
  closeSheet: () => desktopMenus.close(),
});
// Keep the shared form lifecycle in sync with its contextual desktop level.
desktopMenus.subscribe(() => {
  if (useTagFormStore.getState().isVisible && !desktopMenus.getSnapshot().some(entry => entry.type === "tag-form")) {
    useTagFormStore.getState().closeForm();
  }
});
// Editing dialogs are another level, even when the mobile action closed first.
useTagFormStore.subscribe((state, previous) => {
  if (state.isVisible && !previous.isVisible) desktopMenus.open("tag-form");
  else if (!state.isVisible && previous.isVisible) {
    const entry = desktopMenus.getSnapshot().find(entry => entry.type === "tag-form");
    if (entry) desktopMenus.close(entry.id);
  }
});
useColorPickerModalStore.subscribe((state, previous) => {
  if (state.request && !previous.request) desktopMenus.retain();
});

export function captureMenuOrigin(event: Event) {
  const target =
    event.target instanceof Element ? event.target : document.activeElement;
  if (!target) return;
  if (event.type === 'contextmenu' && event instanceof MouseEvent && (event.button === 2 || event.clientX || event.clientY)) {
    desktopMenus.interaction({ x: event.clientX, y: event.clientY, width: 0, height: 0, point: true });
    return;
  }
  const panel = target.closest<HTMLElement>("[data-desktop-menu-id]");
  const control =
    target.closest<HTMLElement>(
      'button, [role="button"], a, input, [tabindex]',
    ) ?? target;
  const rect = control.getBoundingClientRect();
  const parent = panel?.getBoundingClientRect();
  desktopMenus.interaction(
    {
      x: parent?.x ?? rect.x,
      y: rect.y,
      width: parent?.width ?? rect.width,
      height: rect.height,
      offsetY: parent ? rect.y - parent.y : undefined,
    },
    panel ? Number(panel.dataset.desktopMenuId) : undefined,
  );
}
