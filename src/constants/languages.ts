export const APP_LANGUAGES = [
    { code: 'es', name: 'Español', emoji: '🇪🇸' },
    { code: 'en', name: 'English', emoji: '🇬🇧' },
    { code: 'pt', name: 'Português', emoji: '🇵🇹' },
] as const;

export function getDefaultLanguage(systemLanguage: string): 'es' | 'en' | 'pt' {
    const base = systemLanguage.toLowerCase().split(/[-_]/)[0];
    return base === 'es' || base === 'pt' ? base : 'en';
}
