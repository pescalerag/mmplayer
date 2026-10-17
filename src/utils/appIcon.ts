// Keep old launcher aliases installed, but show their replacement in the picker.
const LEGACY_APP_ICONS: Readonly<Record<string, string>> = {
    supporter: 'aqua',
    retro: 'pink',
    darkblue: 'aqua',
    orange: 'yellow',
};

export function normalizeAppIcon(icon: string): string {
    return LEGACY_APP_ICONS[icon] ?? icon;
}

export const STANDALONE_APP_ICON_IDS = ['DEFAULT', 'dark', 'aqua', 'labgreen', 'pink', 'red', 'white', 'yellow'] as const;

export function isStandaloneAppIcon(icon: string): icon is typeof STANDALONE_APP_ICON_IDS[number] {
    return (STANDALONE_APP_ICON_IDS as readonly string[]).includes(icon);
}
