export interface AutoItem {
    id: string;
    title: string;
    subtitle?: string;
    artwork?: string;
    playable?: boolean;
}

export const AUTO_GROUP_SIZE = 80;

export function autoId(kind: string, id: string): string {
    return `${kind}:${encodeURIComponent(id)}`;
}

export function splitAutoId(id: string): [string, string] {
    const separator = id.indexOf(':');
    return separator < 0 ? [id, ''] : [id.slice(0, separator), decodeURIComponent(id.slice(separator + 1))];
}

/** Group large collections into browsable nodes; Auto does not request subsequent pages. */
export function groupAutoItems(parent: string, items: AutoItem[], start = 0, end = items.length): AutoItem[] {
    const length = end - start;
    if (length <= AUTO_GROUP_SIZE) return items.slice(start, end);
    const width = AUTO_GROUP_SIZE ** Math.ceil(Math.log(length / AUTO_GROUP_SIZE) / Math.log(AUTO_GROUP_SIZE));
    const groups: AutoItem[] = [];
    for (let offset = start; offset < end; offset += width) {
        const limit = Math.min(offset + width, end);
        groups.push({ id: autoId('group', JSON.stringify([parent, offset, limit])),
            title: `${items[offset].title} – ${items[limit - 1].title}` });
    }
    return groups;
}

export function normalizeAutoQuery(query: string): string {
    return query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}
