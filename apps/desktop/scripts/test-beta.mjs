import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Network providers have their own/manual acceptance checks. A transient LRCLIB
// outage must not turn a deterministic desktop regression suite into a false fail.
export const betaSheetFilter = 'QUEUE-|CONTEXT-MENUS:|SETTINGS-PC:|FOOTER:|LYRICS-LAYOUT:|MISSING-DETAILS:|SIDEBAR-MOBILE:|APPEARANCE:|Reordenar y guardar|ALL: archivo fisico Compartir|REPAIR: (editar|sincronizar|confirmacion)';
const root = resolve(import.meta.dirname, '..');
const commands = [
  { args: ['scripts/test.mjs'] },
  { args: ['scripts/smoke.mjs'] },
  { args: ['scripts/test-windows-identity.mjs'] },
  // Exercise the Windows CI preference even on a developer machine that allows
  // animations. The visual audit explicitly opts into Reanimated motion.
  { args: ['scripts/test-sheets.mjs', '--filter', betaSheetFilter], env: {
    MMPLAYER_SHEET_SYSTEM_REDUCED_MOTION: '1', MMPLAYER_SHEET_MOTION_MODE: 'never',
  } },
  // Then verify the real System behavior, rather than ignoring accessibility.
  { args: ['scripts/test-sheets.mjs', '--filter', 'APPEARANCE: (cd|vinyl) animacion'], env: {
    MMPLAYER_SHEET_SYSTEM_REDUCED_MOTION: '1', MMPLAYER_SHEET_MOTION_MODE: 'system',
  } },
];
for (const { args, env } of commands) {
  await new Promise((res, rej) => {
    const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, stdio: 'inherit', windowsHide: true });
    child.on('error', rej);
    child.on('exit', code => code === 0 ? res() : rej(Error(`Beta check failed: ${args.join(' ')} (${code})`)));
  });
}
