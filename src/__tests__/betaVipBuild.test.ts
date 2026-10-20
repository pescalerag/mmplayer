import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const { enableBetaVipSettings, enableBetaVipPurchases } = require('../../scripts/beta-build-config.cjs');
const purchaseSource = readFileSync(resolve(__dirname, '../services/PurchasesService.ts'), 'utf8');

function service(beta: boolean, appIcon: string) {
    let listener: (info: unknown) => void = () => {};
    const settings = {
        userTier: beta ? 'VIP' : 'SUPPORTER', appIcon,
        setUserTier: jest.fn((tier: string) => { settings.userTier = beta ? 'VIP' : tier; }),
        setAppIcon: jest.fn((icon: string) => { settings.appIcon = icon; }),
        setHasOrphanedUpgrade: jest.fn(),
    };
    const sdk = {
        getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
        configure: jest.fn().mockResolvedValue(undefined), setLogLevel: jest.fn().mockResolvedValue(undefined),
        addCustomerInfoUpdateListener: jest.fn((next: typeof listener) => { listener = next; }),
    };
    const setAppIcon = jest.fn().mockResolvedValue('DEFAULT');
    const source = beta ? enableBetaVipPurchases(purchaseSource) : purchaseSource;
    const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const module = { exports: {} as { PurchasesService: { init(): Promise<void>; syncCustomerInfo(): Promise<string>; determineUserStatus(info: unknown): { tier: string } } } };
    runInNewContext(`(function(require,module,exports){${javascript}\n})`, { console, __DEV__: false })(
        (name: string) => {
            if (name === 'react-native') return { Platform: { OS: 'android' } };
            if (name === 'react-native-purchases') return { __esModule: true, default: sdk, LOG_LEVEL: { WARN: 'WARN' } };
            if (name === '../store/useSettingsStore') return { useSettingsStore: { getState: () => settings } };
            if (name === '@howincodes/expo-dynamic-app-icon') return { setAppIcon };
            throw new Error('Unexpected dependency: ' + name);
        }, module, module.exports,
    );
    return { purchases: module.exports.PurchasesService, settings, setAppIcon, refresh: () => listener({ entitlements: { active: {} } }) };
}

it.each(['aqua', 'legend', 'develpink', 'crt'])('keeps the beta icon %s through startup and entitlement refreshes', async icon => {
    const { purchases, settings, setAppIcon, refresh } = service(true, icon);
    expect(purchases.determineUserStatus(null).tier).toBe('VIP');
    await purchases.init();
    expect(await purchases.syncCustomerInfo()).toBe('VIP');
    refresh();
    expect(settings.userTier).toBe('VIP');
    expect(settings.appIcon).toBe(icon);
    expect(settings.setAppIcon).not.toHaveBeenCalled();
    expect(setAppIcon).not.toHaveBeenCalled();
});

it('leaves the production resolver and free-user icon policy unchanged', async () => {
    const { purchases, settings, setAppIcon } = service(false, 'aqua');
    expect(purchases.determineUserStatus(null).tier).toBe('USER');
    await purchases.init();
    expect(settings.userTier).toBe('USER');
    expect(settings.appIcon).toBe('DEFAULT');
    expect(setAppIcon).toHaveBeenCalledWith('DEFAULT');
    expect(readFileSync(resolve(__dirname, '../services/PurchasesService.ts'), 'utf8')).toBe(purchaseSource);
});

it('keeps the beta store VIP during hydration and rejects incompatible source transforms', () => {
    const original = readFileSync(resolve(__dirname, '../store/useSettingsStore.ts'), 'utf8');
    const source = enableBetaVipSettings(original);
    expect(source).toContain("userTier: 'VIP',");
    expect(source).toContain("state.setUserTier('VIP');");
    expect(source).toContain("setUserTier: (_tier) => set({ userTier: 'VIP' })");
    expect(() => enableBetaVipPurchases('unexpected')).toThrow('resolver not found');
    expect(() => enableBetaVipSettings('unexpected')).toThrow('configuration not found');
});
