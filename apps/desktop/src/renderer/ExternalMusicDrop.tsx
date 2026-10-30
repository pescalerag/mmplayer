import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  syncExclusionsToWorker,
  pullExclusionsFromWorker,
} from "./ports/scannerService";

export function ExternalMusicDrop() {
  const { t } = useTranslation("desktop");
  const [target, setTarget] = useState<"library" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let importing = false;
    const over = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setTarget("library");
    };
    const leave = (event: DragEvent) => {
      if (!event.relatedTarget) setTarget(null);
    };
    const drop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      event.preventDefault();
      setTarget(null);
      if (importing) return;
      const files = [...event.dataTransfer.files];
      importing = true;
      setBusy(true);
      setError(null);
      void (async () => {
        await syncExclusionsToWorker();
        const result = await window.mmplayer.importDroppedFiles(files);
        if (!result.trackIds.length) throw Error(t("dropNoAudio"));
        await pullExclusionsFromWorker();
      })()
        .catch((error) => setError(String(error)))
        .finally(() => {
          importing = false;
          setBusy(false);
        });
    };
    const clear = () => setTarget(null);
    document.addEventListener("dragover", over);
    document.addEventListener("dragleave", leave);
    document.addEventListener("drop", drop);
    document.addEventListener("dragend", clear);
    window.addEventListener("blur", clear);
    return () => {
      document.removeEventListener("dragover", over);
      document.removeEventListener("dragleave", leave);
      document.removeEventListener("drop", drop);
      document.removeEventListener("dragend", clear);
      window.removeEventListener("blur", clear);
    };
  }, [t]);
  return (
    <>
      {target && (
        <div className="external-music-drop" role="status">
          {t("dropLibrary")}
        </div>
      )}
      {busy && (
        <div className="drop-status" role="status">
          {t("dropImporting")}
        </div>
      )}
      {error && (
        <div className="error-banner" role="alert">
          {error}
          <button aria-label={t("close")} onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}
