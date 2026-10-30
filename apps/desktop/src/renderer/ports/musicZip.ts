import { pickDocumentForCopy } from "../../../../../src/services/DocumentPickerService";
import { useBackupStore } from "../../../../../src/store/useBackupStore";
import { importMusicZip, addMusicZipProgressListener } from "./audioFiles";
import * as FileSystem from "./fileSystem";
import i18n from "../../../../../src/constants/i18n";
let busy = false;
async function importZip(uri: string, name?: string) {
  if (busy) return; busy = true;
  const store = useBackupStore.getState(), cached = FileSystem.cacheDirectory + "music-import-" + crypto.randomUUID() + ".zip";
  store.startImport(i18n.t("music_zip.preparing"));
  const progress = addMusicZipProgressListener(event => store.startImport(i18n.t("music_zip.progress", { count: event.completed, total: event.total })));
  try {
    await FileSystem.copyAsync({ from: uri, to: cached });
    const result = await importMusicZip(cached, name);
    store.setSuccess(i18n.t("music_zip.success", { count: result.imported, skipped: result.skipped, folder: result.folder }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const key = ["no_audio", "not_enough_space", "unsafe_path", "permission_denied", "storage_unavailable", "file_conflict", "invalid_archive"].find(key => message.includes("music_zip." + key));
    store.setError(key ? i18n.t("music_zip." + key) : i18n.t("music_zip.import_error"));
  }
  finally { progress.remove(); await FileSystem.deleteAsync(cached, { idempotent: true }).catch(() => {}); busy = false; }
}
export const MusicZipImportService = {
  importZip,
  async pickAndImportZip() {
    if (busy) return;
    const result = await pickDocumentForCopy(["application/zip", "application/x-zip-compressed"]);
    if (!result.canceled && result.assets?.length) await importZip(result.assets[0].uri, result.assets[0].name);
  },
};
