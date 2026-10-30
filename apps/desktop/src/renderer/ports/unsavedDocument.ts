import { useEffect } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { registerDesktopLeaveGuard } from "../navigationGuard";

export function useUnsavedDocument(dirty: boolean) {
  const { t } = useTranslation();
  useEffect(() => {
    if (!dirty) return;
    return registerDesktopLeaveGuard(proceed => {
      Alert.alert(t("actions.warning"), t("lyrics.unsaved_warning"), [
        { text: t("actions.cancel"), style: "cancel" },
        { text: t("actions.discard"), style: "destructive", onPress: proceed },
      ]);
    });
  }, [dirty, t]);
}
