import i18n from "../../../../../src/constants/i18n";
import { Alert } from "react-native";
import { database } from "./database";
import type { BackupData } from "../../../../../src/utils/backupData";
import { BACKUP_TABLES } from "../../../../../src/utils/backupData";
import { remapBackupTracks } from "../../shared/backupPaths";

export async function remapDesktopBackup(incoming: BackupData): Promise<BackupData> {
  async function remap() {
    const current = Object.fromEntries(await Promise.all(BACKUP_TABLES.map(async table => [table, (await database.get(table).query().fetch()).map(row => ({ ...row._raw }))]))) as BackupData;
    return remapBackupTracks(incoming, current);
  }
  let result = await remap();
  if (result.unmatched) {
    const chooseFolder = await new Promise<boolean | null>(resolve => Alert.alert(i18n.t("backup.desktop_locate_title"),
      i18n.t("backup.desktop_locate_description", { count: result.unmatched }), [
        { text: i18n.t("actions.cancel"), style: "cancel", onPress: () => resolve(null) },
        { text: i18n.t("backup.desktop_continue"), onPress: () => resolve(false) },
        { text: i18n.t("backup.desktop_select_folders"), onPress: () => resolve(true) },
      ]));
    if (chooseFolder === null) throw Error(i18n.t("backup.desktop_cancelled"));
    if (chooseFolder) { await window.mmplayer.invoke("pickMusic", { folders: true }); result = await remap(); }
  }
  return result.data;
}
