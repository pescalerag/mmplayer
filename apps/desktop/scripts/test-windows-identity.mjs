import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';

if (process.platform !== 'win32') {
  console.log('Windows identity test skipped on this platform');
} else {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  await mkdir(resolve(root, 'build'), { recursive: true });
  await copyFile(resolve(root, '../../src/assets/images/icon.png'), resolve(root, 'build/icon.png'));
  const outfile = resolve(root, 'build/windowsIdentity.test.cjs');
  await build({ entryPoints: [resolve(root, 'test/windowsIdentity.ts')], outfile, bundle: true, platform: 'node', format: 'cjs', external: ['electron'] });
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(createRequire(import.meta.url)('electron'), [outfile], { cwd: root, env, stdio: 'inherit', windowsHide: true });
  const timeout = setTimeout(() => { child.kill(); process.exitCode = 1; }, 25000);
  child.on('exit', code => { clearTimeout(timeout); process.exitCode = code ?? 1; });
}
