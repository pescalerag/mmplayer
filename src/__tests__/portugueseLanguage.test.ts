import * as Localization from 'expo-localization';
import i18n from '../constants/i18n';
import { useSettingsStore } from '../store/useSettingsStore';
import { getDefaultLanguage } from '../constants/languages';
import en from '../constants/i18n/en.json';
import es from '../constants/i18n/es.json';
import pt from '../constants/i18n/pt.json';

jest.mock('expo-localization', () => ({ getLocales: jest.fn(() => [{ languageCode: 'en' }]) }));

function flatten(value: any, prefix = ''): Record<string, string> {
    return Object.fromEntries(Object.entries(value).flatMap(([key, child]) =>
        typeof child === 'string' ? [[prefix + key, child]] : Object.entries(flatten(child, `${prefix}${key}.`))
    ));
}

const hydrate = (overrides: Record<string, unknown> = {}) => {
    const state = {
        ...useSettingsStore.getState(),
        language: 'en',
        hasSeenWelcomeModal: true,
        lastSeenVersion: '2.3.2',
        portugueseLanguageOffer: 'unseen',
        setLanguage: jest.fn(),
        setPortugueseLanguageOffer: jest.fn(),
        ...overrides,
    };
    useSettingsStore.persist.getOptions().onRehydrateStorage?.(useSettingsStore.getState())?.(state as any, undefined);
    return state;
};

describe('Portuguese language', () => {
    beforeEach(() => jest.clearAllMocks());

    it.each(['pt', 'pt-BR', 'pt-PT', 'pt_BR'])('detects %s as Portuguese', locale => {
        expect(getDefaultLanguage(locale)).toBe('pt');
    });

    it.each(['pt-BR', 'pt-PT'])('defaults new installations to Portuguese for %s without offering a switch', locale => {
        (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: locale }] as any);
        const state = hydrate({ language: null, hasSeenWelcomeModal: false, lastSeenVersion: null });
        expect(state.setLanguage).toHaveBeenCalledWith('pt');
        expect(state.setPortugueseLanguageOffer).toHaveBeenCalledWith('handled');
    });

    it.each(['en', 'es'])('preserves %s on upgrade and offers Portuguese', language => {
        (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'pt' }] as any);
        const state = hydrate({ language });
        expect(state.setLanguage).not.toHaveBeenCalled();
        expect(state.setPortugueseLanguageOffer).toHaveBeenCalledWith('pending');
    });

    it('recognizes older installations with a recorded version even without the welcome flag', () => {
        (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'pt' }] as any);
        expect(hydrate({ hasSeenWelcomeModal: false }).setPortugueseLanguageOffer).toHaveBeenCalledWith('pending');
    });

    it.each(['pending', 'handled'])('retains a saved %s offer after restart', status => {
        (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'pt' }] as any);
        const state = hydrate({ portugueseLanguageOffer: status });
        expect(state.setPortugueseLanguageOffer).not.toHaveBeenCalled();
    });

    it.each(['pt', 'pt-PT'])('does not offer Portuguese when %s is already selected', language => {
        (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'pt' }] as any);
        expect(hydrate({ language }).setPortugueseLanguageOffer).toHaveBeenCalledWith('handled');
    });

    it('does not offer the change on non-Portuguese devices', () => {
        (Localization.getLocales as jest.Mock).mockReturnValue([{ languageCode: 'es' }] as any);
        expect(hydrate().setPortugueseLanguageOffer).toHaveBeenCalledWith('handled');
    });

    it('accepts Portuguese and resolves the offer in one state update', () => {
        useSettingsStore.setState({ language: 'en', portugueseLanguageOffer: 'pending' });
        useSettingsStore.getState().setLanguage('pt');
        expect(useSettingsStore.getState()).toMatchObject({ language: 'pt', portugueseLanguageOffer: 'handled' });
    });

    it('declining preserves the current language', () => {
        useSettingsStore.setState({ language: 'es', portugueseLanguageOffer: 'pending' });
        useSettingsStore.getState().setPortugueseLanguageOffer('handled');
        expect(useSettingsStore.getState()).toMatchObject({ language: 'es', portugueseLanguageOffer: 'handled' });
    });

    it('covers both existing catalogs and preserves every interpolation parameter', () => {
        const portuguese = flatten(pt);
        for (const source of [flatten(en), flatten(es)]) {
            expect(Object.keys(portuguese).sort()).toEqual(Object.keys(source).sort());
            for (const [key, value] of Object.entries(source)) {
                expect(portuguese[key]?.trim()).toBeTruthy();
                const parameters = (text: string) => (text.match(/{{[^}]+}}/g) ?? []).sort();
                expect({ key, parameters: parameters(portuguese[key]) }).toEqual({ key, parameters: parameters(value) });
            }
        }
    });

    it('uses the registered Portuguese catalog instead of falling back to English', async () => {
        await i18n.changeLanguage('pt-PT');
        expect(i18n.t('navigation.library')).toBe('Biblioteca');
        expect(i18n.t('language_offer.confirm')).toBe('Mudar para português');
        expect(i18n.t('toasts.library_added_tracks', { count: 2 })).toBe('2 novas músicas adicionadas');
    });
});
