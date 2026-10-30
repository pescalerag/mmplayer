import React, { useEffect, useState } from "react";
import { View, Text, Switch } from "react-native";
import { useTranslation } from "react-i18next";
import { combineLatest } from "rxjs";
import { SettingsScreenView } from "../../../../../src/screens/settings/SettingsScreenView";
import { useAppTheme } from "../../../../../src/hooks/useAppTheme";
import { BackupService } from "../../../../../src/services/BackupService";
import { MusicZipImportService } from "../../../../../src/services/MusicZipImportService";
import { remapDesktopBackup } from "./backupPaths";
import { database } from "./database";

export default function DesktopSettingsScreen() {
  const { t } = useTranslation("desktop");
  const { colors, fonts } = useAppTheme();
  const [counts, setCounts] = useState<number[]>([]);
  const [closeToTray, setCloseToTray] = useState(false);
  useEffect(() => {
    const subscription = combineLatest(
      ["tracks", "albums", "artists"].map((table) =>
        database.get(table).query().observeCount(),
      ),
    ).subscribe(setCounts);
    void window.mmplayer
      .invoke("state", undefined)
      .then((state) => setCloseToTray(state.preferences.closeToTray));
    return () => subscription.unsubscribe();
  }, []);
  return (
    <SettingsScreenView
      tracksCount={counts[0] ?? null}
      albumsCount={counts[1] ?? null}
      artistsCount={counts[2] ?? null}
      showSupport={false}
      actions={{
        exportDatabase: format => { void BackupService.exportDatabase(format); },
        importDatabase: format => { void BackupService.importDatabase(format, remapDesktopBackup); },
        importMusicZip: () => { void MusicZipImportService.pickAndImportZip(); },
      }}
      extraContent={
        <View
          style={{
            padding: 20,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ color: colors.text, fontFamily: fonts.regular }}>
            {t("closeToTray")}
          </Text>
          <Switch
            value={closeToTray}
            onValueChange={(value) => {
              setCloseToTray(value);
              void window.mmplayer
                .invoke("preferences", { closeToTray: value })
                .catch((error) => console.error(error));
            }}
          />
        </View>
      }
    />
  );
}
