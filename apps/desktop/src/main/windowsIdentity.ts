import { app, nativeImage, shell } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export const WINDOWS_APP_ID = 'com.pescalerag.mmplayer.desktop';

/** Windows resolves the SMTC source name through the Start menu application catalog. */
export async function registerWindowsIdentity(options: {
  appId?: string;
  name?: string;
  iconPath: string;
  directory?: string;
}): Promise<string | undefined> {
  if (process.platform !== 'win32') return;
  const appId = options.appId ?? WINDOWS_APP_ID;
  const name = options.name ?? 'MMPlayer';
  const directory = options.directory ?? app.getPath('userData');
  const icon = join(directory, 'windows-app.ico');
  const png = nativeImage.createFromPath(options.iconPath).resize({ width: 256, height: 256 }).toPNG();
  if (!png.length) throw Error('Missing Windows application icon');
  // ICO supports a PNG payload. A zero width/height denotes 256 pixels.
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18);
  const image = Buffer.concat([header, png]);
  await mkdir(directory, { recursive: true });
  const previous = await readFile(icon).catch(() => null);
  if (!previous?.equals(image)) await writeFile(icon, image);

  const shortcut = join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', `${name}.lnk`);
  const details = {
    target: process.execPath,
    args: app.isPackaged ? '' : `"${app.getAppPath()}"`,
    cwd: dirname(process.execPath),
    description: name,
    appUserModelId: appId,
    icon,
    iconIndex: 0,
  };
  await mkdir(dirname(shortcut), { recursive: true });
  let existing;
  try { existing = shell.readShortcutLink(shortcut); } catch { /* First launch. */ }
  if (!existing || Object.entries(details).some(([key, value]) => existing[key as keyof typeof existing] !== value)) {
    if (!shell.writeShortcutLink(shortcut, existing ? 'update' : 'create', details)) throw Error('Windows application registration failed');
  }
  return icon;
}
