import randomId from '@nozbe/watermelondb/utils/common/randomId';
import { mySchema } from '../database/schema';

export type BackupRow = Record<string, string | number | boolean | null> & { id: string };
export type BackupData = Record<string, BackupRow[]>;
export interface BackupImportOptions { mode: 'replace' | 'merge'; conflicts: 'current' | 'imported' }
export const BACKUP_TABLES = Object.keys(mySchema.tables);
const ORDER = ['artists', 'albums', 'tracks', 'playlists', 'tags', 'playback_history', 'search_history', 'notifications',
    'playlist_tracks', 'track_tags', 'album_tags', 'track_collaborators', 'playback_history_tags'];
const normalize = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const libraryName = (value: unknown) => normalize(value).replace(/[^a-z0-9\s]/g, '');

export function validateBackupData(value: unknown): BackupData {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('backup.invalid_format');
    const object = value as Record<string, unknown>;
    if (!BACKUP_TABLES.some(table => Array.isArray(object[table]))) throw new Error('backup.incompatible_data');
    const result: BackupData = {};
    for (const table of BACKUP_TABLES) {
        if (object[table] !== undefined && !Array.isArray(object[table])) throw new Error('backup.invalid_format');
        const ids = new Set<string>();
        result[table] = ((object[table] ?? []) as unknown[]).map(item => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('backup.invalid_format');
            const raw = item as Record<string, unknown>;
            if (typeof raw.id !== 'string' || !raw.id || ids.has(raw.id)) throw new Error('backup.invalid_format');
            ids.add(raw.id);
            const row: BackupRow = { id: raw.id };
            for (const column of Object.values(mySchema.tables[table].columns)) {
                const field = raw[column.name];
                // Old exports do not know newer columns. Do not turn their
                // absence into an explicit null that erases current metadata.
                if (field === undefined) continue;
                if (field === null) {
                    row[column.name] = column.isOptional ? null : ({ string: '', number: 0, boolean: false }[column.type]);
                } else {
                    if (typeof field !== column.type || (typeof field === 'number' && !Number.isFinite(field))) throw new Error('backup.invalid_format');
                    row[column.name] = field as string | number | boolean;
                }
            }
            return row;
        });
    }
    return result;
}

const FOREIGN_KEYS: Record<string, string> = {
    album_id: 'albums', artist_id: 'artists', playlist_id: 'playlists', track_id: 'tracks', tag_id: 'tags', history_id: 'playback_history',
};

function identity(table: string, row: BackupRow): string {
    switch (table) {
        case 'artists': return libraryName(row.normalized_name || row.name);
        case 'albums': return JSON.stringify([libraryName(row.normalized_title || row.title), row.artist_id]);
        case 'tracks': return String(row.file_url || trackIdentity(row));
        case 'tags': return normalize(row.normalized_name || row.name);
        case 'playlists': return normalize(row.name);
        case 'search_history': return normalize(row.query);
        case 'playback_history': return JSON.stringify([row.item_type, row.item_id, row.played_at, row.play_context]);
        case 'notifications': return JSON.stringify([row.type, row.created_at, row.title, row.action_payload]);
        default: return JSON.stringify(Object.keys(row).sort().filter(key => key !== 'id' && key !== 'order').map(key => [key, row[key]]));
    }
}

function trackIdentity(row: BackupRow): string {
    return JSON.stringify([libraryName(row.normalized_title || row.title), row.album_id, row.artist_id, Math.round(Number(row.duration)), row.track_number, row.disc_number]);
}

function compatibleId(table: string, existing: BackupRow, incoming: BackupRow): boolean {
    if (table === 'tracks') return existing.file_url === incoming.file_url || trackIdentity(existing) === trackIdentity(incoming);
    if (table === 'playback_history' || table === 'playlist_tracks' || table === 'track_collaborators' || table.endsWith('_tags')) {
        return identity(table, existing) === identity(table, incoming);
    }
    return true;
}

function remapRow(row: BackupRow, table: string, maps: Record<string, Map<string, string>>): BackupRow {
    const copy = { ...row };
    for (const [key, target] of Object.entries(FOREIGN_KEYS)) {
        const id = copy[key];
        if (typeof id === 'string') copy[key] = maps[target]?.get(id) ?? id;
    }
    if (table === 'playback_history') {
        const target = { track: 'tracks', album: 'albums', artist: 'artists', playlist: 'playlists' }[String(copy.item_type)];
        if (target) copy.item_id = maps[target]?.get(String(copy.item_id)) ?? copy.item_id;
    }
    return copy;
}

function combineRows(existing: BackupRow, imported: BackupRow, table: string, conflicts: BackupImportOptions['conflicts']): BackupRow {
    const result = { ...existing };
    for (const [key, value] of Object.entries(imported)) {
        if (key === 'id') continue;
        if (conflicts === 'imported' || result[key] === null || result[key] === '') result[key] = value;
    }
    // A later export can contain a longer update of the same listen: never add
    // that listen a second time or shorten the already recorded duration.
    if (table === 'playback_history') result.duration_played = Math.max(Number(existing.duration_played) || 0, Number(imported.duration_played) || 0);
    if (table === 'tracks' && existing.file_url) {
        // Imported MediaStore URLs belong to the other phone. An already
        // available local copy must keep its working playback location.
        result.file_url = existing.file_url;
        if (existing.last_modified !== undefined) result.last_modified = existing.last_modified;
    }
    return result;
}

/** Map relationships in memory; each source table is read only once. */
export function mergeBackupData(current: BackupData, incoming: BackupData, conflicts: BackupImportOptions['conflicts']): BackupData {
    const result: BackupData = {};
    const maps: Record<string, Map<string, string>> = {};
    for (const table of [...ORDER, ...BACKUP_TABLES.filter(table => !ORDER.includes(table))]) {
        const rows = (current[table] ?? []).map(row => ({ ...row }));
        result[table] = rows;
        const byId = new Map(rows.map(row => [row.id, row]));
        const byIdentity = new Map(rows.map(row => [identity(table, row), row]));
        const byTrack = new Map(table === 'tracks' ? rows.map(row => [trackIdentity(row), row]) : []);
        const idMap = new Map<string, string>(); maps[table] = idMap;
        const occurrences = new Map<string, number>();
        const localOccurrences = new Map<string, number>();
        if (table === 'playlist_tracks') {
            byIdentity.clear();
            for (const row of [...rows].sort((a, b) => Number(a.order) - Number(b.order))) {
                const key = identity(table, row), occurrence = localOccurrences.get(key) ?? 0;
                localOccurrences.set(key, occurrence + 1); byIdentity.set(key + ':' + occurrence, row);
            }
        }
        const source = table === 'playlist_tracks' ? [...incoming[table] ?? []].sort((a, b) => Number(a.order) - Number(b.order)) : incoming[table] ?? [];
        for (const sourceRow of source) {
            const row = remapRow(sourceRow, table, maps);
            let key = identity(table, row);
            if (table === 'playlist_tracks') {
                const occurrence = occurrences.get(key) ?? 0; occurrences.set(key, occurrence + 1); key += ':' + occurrence;
            }
            const sameId = byId.get(row.id);
            // MediaStore numeric IDs may identify different files on another phone.
            const idCompatible = sameId && compatibleId(table, sameId, row);
            const existing = (idCompatible ? sameId : undefined) ?? byIdentity.get(key) ?? (table === 'tracks' ? byTrack.get(trackIdentity(row)) : undefined);
            if (existing) {
                idMap.set(sourceRow.id, existing.id);
                Object.assign(existing, combineRows(existing, row, table, conflicts));
                continue;
            }
            if (byId.has(row.id)) row.id = randomId();
            idMap.set(sourceRow.id, row.id); rows.push(row); byId.set(row.id, row); byIdentity.set(key, row);
            if (table === 'tracks') byTrack.set(trackIdentity(row), row);
        }
    }
    // Playlist duplicates are intentional. Union their occurrences, preserving
    // the preferred source's sequence and appending the other source's extras.
    const playlistRows = result.playlist_tracks;
    const incomingOrder = new Map((incoming.playlist_tracks ?? []).map(row => [maps.playlist_tracks.get(row.id), Number(row.order)]));
    const originalOrder = new Map((current.playlist_tracks ?? []).map(row => [row.id, Number(row.order)]));
    playlistRows.sort((a, b) => {
        const preferred = conflicts === 'imported' ? incomingOrder : originalOrder;
        const aOrder = preferred.get(a.id), bOrder = preferred.get(b.id);
        if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
        if (aOrder !== undefined) return -1;
        if (bOrder !== undefined) return 1;
        return Number(a.order) - Number(b.order);
    });
    const counters = new Map<string, number>();
    for (const row of playlistRows) {
        const id = String(row.playlist_id), order = counters.get(id) ?? 0;
        row.order = order; counters.set(id, order + 1);
    }
    return result;
}
