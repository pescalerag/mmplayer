import type { BackupData, BackupRow } from "../../../../src/utils/backupData";
const text = (value: unknown) => String(value ?? "").normalize("NFC").trim().toLowerCase();
function filename(value: unknown) {
  try { return text(decodeURIComponent(String(value ?? "").replace(/\\/g, "/").split("/").pop() ?? "")); } catch { return ""; }
}
/** Never guess between duplicates. Remap IDs as well as paths: the desktop file
 * index uses path-derived IDs to resolve audio, covers and future scans. */
export function remapBackupTracks(incoming: BackupData, current: BackupData) {
  const names = (data: BackupData, table: string, column: string) => new Map((data[table] ?? []).map(row => [row.id, text(row[column])]));
  const artists = names(incoming, "artists", "name"), albums = names(incoming, "albums", "title");
  const localArtists = names(current, "artists", "name"), localAlbums = names(current, "albums", "title");
  const mapped = new Map<string, BackupRow>(), used = new Set<string>();
  for (const row of incoming.tracks ?? []) {
    const candidates = (current.tracks ?? []).filter(local => !used.has(local.id));
    let matches = candidates.filter(local => local.file_url === row.file_url);
    if (matches.length !== 1) matches = candidates.filter(local => text(local.title) === text(row.title)
      && localArtists.get(String(local.artist_id)) === artists.get(String(row.artist_id))
      && localAlbums.get(String(local.album_id)) === albums.get(String(row.album_id))
      && Math.abs(Number(local.duration) - Number(row.duration)) <= 2);
    if (matches.length > 1) matches = matches.filter(local => filename(local.file_url) === filename(row.file_url));
    if (matches.length === 1) { mapped.set(row.id, matches[0]); used.add(matches[0].id); }
  }
  const data: BackupData = Object.fromEntries(Object.entries(incoming).map(([table, rows]) => [table, rows.map(row => {
    const copy = { ...row }, match = table === "tracks" ? mapped.get(row.id) : undefined;
    if (match) { copy.id = match.id; copy.file_url = match.file_url; }
    if (typeof copy.track_id === "string") copy.track_id = mapped.get(copy.track_id)?.id ?? copy.track_id;
    if (table === "playback_history" && copy.item_type === "track") copy.item_id = mapped.get(String(copy.item_id))?.id ?? copy.item_id;
    return copy;
  })]));
  return { data, matched: mapped.size, unmatched: (incoming.tracks ?? []).length - mapped.size };
}
