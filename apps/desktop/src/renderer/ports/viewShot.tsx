import React, { forwardRef } from "react";
import { View } from "react-native";
import ioniconsFont from "@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf?url";
import materialFont from "@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf?url";
import fontUrl from "../../../../../src/assets/fonts/Montserrat-VariableFont_wght.ttf?url";

interface CaptureOptions { format?: "png" | "jpg" | "jpeg"; quality?: number; width?: number; height?: number; result?: "tmpfile" | "base64" | "data-uri" }
async function asDataUri(uri: string) {
  if (uri.startsWith("data:")) return uri;
  const response = await fetch(uri);
  if (!response.ok) throw Error("Could not load card asset");
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();reader.onload = () => resolve(String(reader.result));reader.onerror = reject;
    void response.blob().then(blob => reader.readAsDataURL(blob), reject);
  });
}
const fonts = new Map<string, Promise<string>>();
function fontData(uri: string) { if (!fonts.has(uri)) fonts.set(uri, asDataUri(uri).catch(error => { fonts.delete(uri); throw error; })); return fonts.get(uri)!; }
export async function captureRef(ref: React.RefObject<HTMLElement | null> | HTMLElement, options: CaptureOptions = {}): Promise<string> {
  const element = ref instanceof HTMLElement ? ref : ref?.current;
  if (!(element instanceof HTMLElement)) throw Error("Card is not mounted");
  await document.fonts.ready;
  await Promise.all([...element.querySelectorAll("img")].map(img => img.decode().catch(() => {})));
  const bounds = element.getBoundingClientRect();
  const computedSize = getComputedStyle(element);
  const width = parseFloat(computedSize.width) || bounds.width, height = parseFloat(computedSize.height) || bounds.height;
  if (!width || !height) throw Error("Card has no dimensions");
  const clone = element.cloneNode(true) as HTMLElement;
  const originals = [element, ...element.querySelectorAll("*")], copies = [clone, ...clone.querySelectorAll("*")];
  const families = new Set<string>();
  await Promise.all(originals.map(async (original, index) => {
    const copy = copies[index] as HTMLElement;
    // Freeze RN Web's computed styles; stylesheets and surrounding app controls
    // never enter the isolated capture renderer.
    const computed = getComputedStyle(original);families.add(computed.fontFamily);
    const style = [...computed].map(name => `${name}:${computed.getPropertyValue(name)};`).join("");
    copy.setAttribute("style", style);
    for (const attribute of [...copy.attributes]) if (attribute.name !== "style" && attribute.name !== "src" && !attribute.name.startsWith("xmlns") && original.tagName.toLowerCase() !== "svg" && !(original instanceof SVGElement)) copy.removeAttribute(attribute.name);
    if (original instanceof HTMLImageElement) {
      copy.setAttribute("src", await asDataUri(original.currentSrc || original.src));copy.removeAttribute("srcset");copy.removeAttribute("loading");
    }
    // expo-image can also use a CSS background; keep those resources local.
    if (computed.backgroundImage.includes("url(")) {
      const urls = [...computed.backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)];
      let background = computed.backgroundImage;
      for (const match of urls) background = background.replace(match[0], `url("${await asDataUri(match[1])}")`);
      copy.style.backgroundImage = background;
    }
  }));
  clone.querySelectorAll("script,iframe,object,embed,link,style").forEach(node => node.remove());
  Object.assign(clone.style, { position: "relative", left: "0", top: "0", margin: "0", transform: "none", width: width + "px", height: height + "px", flexShrink: "0" });
  const montserrat = await fontData(fontUrl);
  const fontFaces = ["Montserrat", "Montserrat-Regular", "Montserrat-SemiBold", "Montserrat-Bold", "Montserrat-Italic", "Montserrat-BoldItalic"].filter(family => family === "Montserrat" || [...families].some(name => name.includes(family))).map(family => `@font-face{font-family:"${family}";src:url("${montserrat}");font-weight:100 900;}`).join("");
  let iconFaces = "";
  for (const [family, uri] of [["Ionicons", ioniconsFont], ["MaterialCommunityIcons", materialFont]]) {
    if ([...families].some(name => name.includes(family))) iconFaces += `@font-face{font-family:"${family}";src:url("${await fontData(uri)}");}`;
  }
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fontFaces}${iconFaces}html,body{margin:0;padding:0;overflow:hidden;background:transparent;}body{font-family:Montserrat,sans-serif;}#capture{transform-origin:top left;}</style></head><body><div id="capture">${clone.outerHTML}</div></body></html>`;
  const uri = await window.mmplayer.invoke("captureCard", { html, width, height, outputWidth: options.width ?? Math.round(width), outputHeight: options.height ?? Math.round(height), format: options.format ?? "png", quality: options.quality ?? 1 });
  if (options.result === "base64" || options.result === "data-uri") {
    const data = await asDataUri(uri);return options.result === "data-uri" ? data : data.slice(data.indexOf(",") + 1);
  }
  return uri;
}

export const ViewShot = forwardRef<any, any>(({ children, style, options: _options, ...rest }, ref) => (
  <View ref={ref} testID="desktop-share-card" style={style} {...rest}>{children}</View>
));
ViewShot.displayName = "ViewShot";
export const onUnhandled = () => {};
export const onHandled = () => {};
export const StatusBar = () => null;
export default Object.assign(ViewShot, { captureRef, onUnhandled, onHandled, StatusBar });
