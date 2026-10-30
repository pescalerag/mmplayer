import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Network providers have their own/manual acceptance checks. A transient LRCLIB
// outage must not turn a deterministic desktop regression suite into a false fail.
export const betaSheetFilter = 'QUEUE-|CONTEXT-MENUS:|SETTINGS-PC:|FOOTER:|LYRICS-LAYOUT:|MISSING-DETAILS:|SIDEBAR-MOBILE:|APPEARANCE:|Reordenar y guardar|ALL: archivo fisico Compartir|REPAIR: (editar|sincronizar|confirmacion)';
const root = resolve(import.meta.dirname, '..');
const commands = [
  ['scripts/test.mjs'],
  ['scripts/smoke.mjs'],
  ['scripts/test-windows-identity.mjs'],
  ['scripts/test-sheets.mjs', '--filter', betaSheetFilter],
];
for (const args of commands) {
  await new Promise((res, rej) => {
    const child = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
    child.on('error', rej);
    child.on('exit', code => code === 0 ? res() : rej(Error(`Beta check failed: ${args.join(' ')} (${code})`)));
  });
}
