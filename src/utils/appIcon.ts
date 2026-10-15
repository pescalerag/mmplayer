// Keep old launcher aliases installed, but show their replacement in the picker.
const LEGACY_APP_ICONS: Readonly<Record<string, string>> = {
    supporter: 'aqua',
    retro: 'pink',
    darkblue: 'aqua',
    orange: 'yellow',
    legend: 'yellow',
};

export function normalizeAppIcon(icon: string): string {
    return LEGACY_APP_ICONS[icon] ?? icon;
}
