export async function isAvailableAsync() { return true; }
export async function shareAsync(uri: string, _options?: Record<string, unknown>) {
  const saved = await window.mmplayer.invoke("saveFile", { uri, name: decodeURIComponent(uri.split("/").pop() || "MMPlayer") });
  if (!saved) throw Object.assign(new Error("Exportación cancelada"), { code: "USER_CANCELLED" });
}
