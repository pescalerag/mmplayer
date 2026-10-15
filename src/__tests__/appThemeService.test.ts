import { Platform } from 'react-native';
import { getAppIcon, setAppIcon } from '@howincodes/expo-dynamic-app-icon';
import { applyAppTheme, applyStandaloneAppIcon, reconcileExclusiveThemeIcon } from '../services/AppThemeService';
import { useSettingsStore } from '../store/useSettingsStore';

jest.mock('@howincodes/expo-dynamic-app-icon', () => ({ getAppIcon: jest.fn(), setAppIcon: jest.fn() }));

describe('theme and launcher icon consistency', () => {
  const original = useSettingsStore.getState();
  const originalPlatform = Platform.OS;
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
    useSettingsStore.setState({ userTier: 'SUPPORTER', activeAppTheme: 'none', appIcon: 'DEFAULT', customAccentColor: '#112233' });
    (getAppIcon as jest.Mock).mockResolvedValue('DEFAULT');
    (setAppIcon as jest.Mock).mockResolvedValue('DEFAULT');
  });
  afterEach(() => {
    useSettingsStore.setState(original);
    Object.defineProperty(Platform, 'OS', { configurable: true, value: originalPlatform });
  });

  it.each([['develETSII', 'develpink'], ['legendary', 'legend']] as const)('applies %s with its own icon in a single settings update', async (theme, icon) => {
    await applyAppTheme(theme);
    expect(setAppIcon).toHaveBeenCalledWith(icon, false);
    expect(useSettingsStore.getState()).toMatchObject({ activeAppTheme: theme, appIcon: icon, customAccentColor: null });
  });

  it('restores the default icon when disabling a theme', async () => {
    useSettingsStore.setState({ activeAppTheme: 'develETSII', appIcon: 'develpink' });
    await applyAppTheme('none');
    expect(setAppIcon).toHaveBeenCalledWith(null, false);
    expect(useSettingsStore.getState()).toMatchObject({ activeAppTheme: 'none', appIcon: 'DEFAULT' });
  });

  it('rejects theme icons as standalone choices and protects paid themes', async () => {
    await expect(applyStandaloneAppIcon('develpink')).rejects.toThrow('exclusive');
    await expect(applyStandaloneAppIcon('legend')).rejects.toThrow('exclusive');
    useSettingsStore.setState({ userTier: 'USER' });
    await expect(applyAppTheme('develETSII')).rejects.toThrow('not available');
    await expect(applyStandaloneAppIcon('aqua')).rejects.toThrow('not available');
    expect(setAppIcon).not.toHaveBeenCalled();
  });

  it('leaves the current theme intact if Android rejects the new icon, then accepts another choice', async () => {
    useSettingsStore.setState({ activeAppTheme: 'legendary', appIcon: 'legend' });
    (setAppIcon as jest.Mock).mockResolvedValueOnce(false);
    await expect(applyAppTheme('develETSII')).rejects.toThrow('Could not apply');
    expect(useSettingsStore.getState()).toMatchObject({ activeAppTheme: 'legendary', appIcon: 'legend', customAccentColor: '#112233' });
    await applyStandaloneAppIcon('aqua');
    expect(useSettingsStore.getState()).toMatchObject({ activeAppTheme: 'none', appIcon: 'aqua' });
  });

  it('resets a pre-update standalone devel icon without enabling the new theme', async () => {
    useSettingsStore.setState({ appIcon: 'develpink' });
    (getAppIcon as jest.Mock).mockResolvedValue('develpink');
    await reconcileExclusiveThemeIcon();
    expect(setAppIcon).toHaveBeenCalledWith(null, false);
    expect(useSettingsStore.getState()).toMatchObject({ activeAppTheme: 'none', appIcon: 'DEFAULT' });
  });

  it('preserves the icon while the devel theme is active', async () => {
    useSettingsStore.setState({ activeAppTheme: 'develETSII', appIcon: 'develpink' });
    (getAppIcon as jest.Mock).mockResolvedValue('develpink');
    await reconcileExclusiveThemeIcon();
    expect(setAppIcon).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().appIcon).toBe('develpink');
  });

  it('reconciles a stale stored icon with another actual launcher choice', async () => {
    useSettingsStore.setState({ appIcon: 'develpink' });
    (getAppIcon as jest.Mock).mockResolvedValue('aqua');
    await reconcileExclusiveThemeIcon();
    expect(setAppIcon).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().appIcon).toBe('aqua');
  });

  it('keeps unrelated launcher icons untouched', async () => {
    useSettingsStore.setState({ appIcon: 'white' });
    (getAppIcon as jest.Mock).mockResolvedValue('white');
    await reconcileExclusiveThemeIcon();
    expect(setAppIcon).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().appIcon).toBe('white');
  });

  it('does not claim migration succeeded when the native reset fails', async () => {
    useSettingsStore.setState({ appIcon: 'develpink' });
    (getAppIcon as jest.Mock).mockResolvedValue('develpink');
    (setAppIcon as jest.Mock).mockResolvedValue(false);
    await expect(reconcileExclusiveThemeIcon()).rejects.toThrow('Could not reset');
    expect(useSettingsStore.getState().appIcon).toBe('develpink');
  });

  it('orders migration before a newly selected theme so it cannot overwrite the new choice', async () => {
    let finishReset!: () => void;
    (getAppIcon as jest.Mock).mockResolvedValue('develpink');
    (setAppIcon as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { finishReset = () => resolve('DEFAULT'); }));
    const migration = reconcileExclusiveThemeIcon();
    for (let i = 0; i < 10 && !finishReset; i++) await Promise.resolve();
    expect(finishReset).toBeDefined();
    const change = applyAppTheme('develETSII');
    expect(setAppIcon).toHaveBeenCalledTimes(1);
    finishReset();
    await Promise.all([migration, change]);
    expect(setAppIcon).toHaveBeenNthCalledWith(2, 'develpink', false);
    expect(useSettingsStore.getState()).toMatchObject({ activeAppTheme: 'develETSII', appIcon: 'develpink' });
  });

  it('applies the visual theme on web without calling unsupported launcher APIs', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    await applyAppTheme('develETSII');
    await reconcileExclusiveThemeIcon();
    expect(setAppIcon).not.toHaveBeenCalled();
    expect(getAppIcon).not.toHaveBeenCalled();
    expect(useSettingsStore.getState().activeAppTheme).toBe('develETSII');
  });
});
