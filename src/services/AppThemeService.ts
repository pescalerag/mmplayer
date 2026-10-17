import { Platform } from 'react-native';
import { useSettingsStore } from '../store/useSettingsStore';
import { AppTheme, getAppThemeIcon, resolveAppTheme } from '../theme/appTheme';
import { isStandaloneAppIcon } from '../utils/appIcon';

let pendingIconUpdate = Promise.resolve();
function updateIcon(action: () => Promise<void>): Promise<void> {
  const result = pendingIconUpdate.then(action);
  pendingIconUpdate = result.catch(() => {});
  return result;
}

export function applyAppTheme(theme: AppTheme): Promise<void> {
  return updateIcon(async () => {
    const settings = useSettingsStore.getState();
    if (resolveAppTheme(theme, settings.userTier) !== theme) throw new Error('App theme is not available');
    const icon = getAppThemeIcon(theme);
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const { setAppIcon } = await import('@howincodes/expo-dynamic-app-icon');
      const result = await setAppIcon(icon, false);
      if (result === false) throw new Error('Could not apply theme icon');
    }
    useSettingsStore.setState({
      activeAppTheme: theme,
      appIcon: icon ?? 'DEFAULT',
      ...(theme === 'none' ? {} : { customAccentColor: null }),
    });
  });
}

export function applyStandaloneAppIcon(icon: string): Promise<void> {
  return updateIcon(async () => {
    if (!isStandaloneAppIcon(icon)) throw new Error('Icon is exclusive to an app theme');
    if (icon !== 'DEFAULT' && useSettingsStore.getState().userTier === 'USER') throw new Error('Icon is not available');
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      const { setAppIcon } = await import('@howincodes/expo-dynamic-app-icon');
      if (await setAppIcon(icon === 'DEFAULT' ? null : icon, false) === false) throw new Error('Could not apply icon');
    }
    useSettingsStore.setState({ appIcon: icon, activeAppTheme: 'none' });
  });
}

// The existing launcher alias must survive upgrades, but is now theme-exclusive.
export function reconcileExclusiveThemeIcon(): Promise<void> {
  return updateIcon(async () => {
    if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
    const { getAppIcon, setAppIcon } = await import('@howincodes/expo-dynamic-app-icon');
    const icon = await getAppIcon();
    const settings = useSettingsStore.getState();
    if (resolveAppTheme(settings.activeAppTheme, settings.userTier) === 'develETSII') return;
    if (icon !== 'develpink') {
      if (settings.appIcon === 'develpink') settings.setAppIcon(icon);
      return;
    }
    const result = await setAppIcon(null, false);
    if (result === false) throw new Error('Could not reset retired standalone icon');
    useSettingsStore.getState().setAppIcon('DEFAULT');
  });
}
