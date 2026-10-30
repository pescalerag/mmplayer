import { desktopMenus } from "../desktopMenus";
let current: any;
export function setDesktopNavigation(navigation: any) {
  current = navigation;
}
export const navigationRef = {
  isReady: () => !!current,
  navigate: (name: string, params?: any) => {
    desktopMenus.clear();
    return current?.navigate(name, params);
  },
  goBack: () =>
    current?.goBack
      ? current.goBack()
      : current?.dispatch?.({ type: "GO_BACK" }),
  canGoBack: () => (current?.canGoBack ? current.canGoBack() : false),
  dispatch: (action: any) => current?.dispatch(action),
  getRootState: () => current?.getState(),
  getCurrentRoute: () => {
    const state = current?.getState();
    return state?.routes?.[state.index ?? state.routes.length - 1];
  },
};
export const waitForNavigationReady = async () => !!current;
