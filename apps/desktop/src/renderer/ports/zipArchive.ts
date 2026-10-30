async function archive(action: "zip" | "unzip" | "size", source: string | string[], target?: string) {
  return window.mmplayer.invoke("fileSystem", { op: "archive", action, sources: Array.isArray(source) ? source : [source], target });
}
export const zip = async (source: string | string[], target: string) => await archive("zip", source, target) as string;
export const unzip = async (source: string, target: string) => await archive("unzip", source, target) as string;
export const getUncompressedSize = async (source: string) => await archive("size", source) as number;
export const subscribe = () => ({ remove: () => {} });
export default { zip, unzip, getUncompressedSize, subscribe };
