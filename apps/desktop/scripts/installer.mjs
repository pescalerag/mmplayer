import { build as compile } from './build.mjs';
import { build, Platform } from 'electron-builder';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, rm, cp, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const preview = process.argv.includes('--preview');
const unsignedBeta = process.argv.includes('--unsigned-beta');
if (preview && unsignedBeta) throw Error('Choose preview or unsigned beta');
if (process.platform !== 'win32') throw Error('Build the Windows installer on Windows');
if (preview) process.env.MMPLAYER_UNSIGNED_PREVIEW = '1';
else delete process.env.MMPLAYER_UNSIGNED_PREVIEW;
if (unsignedBeta) process.env.MMPLAYER_UNSIGNED_BETA = '1';
else delete process.env.MMPLAYER_UNSIGNED_BETA;
// Fail before compiling if signing has not been configured.
const config = require('../electron-builder.cjs');
const metadata = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
await compile();
const stage = resolve(root, 'build/package');
if (!stage.startsWith(resolve(root, 'build') + '\\')) throw Error('Unsafe staging path');
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
for (const file of ['main.cjs', 'preload.cjs', 'libraryWorker.cjs', 'metadataWorker.cjs', 'icon.png', 'renderer']) {
  await cp(resolve(root, 'build', file), join(stage, file), { recursive: true, filter: source => !source.endsWith('.map') });
}
const notices = resolve(root, 'build/notices');
await mkdir(notices, { recursive: true });
await cp(resolve(root, 'third-party'), notices, { recursive: true });
await cp(resolve(root, '../../LICENSE'), join(notices, 'MMPlayer-LICENSE.txt'));

// Retain the exact installed runtime dependency versions and their licenses.
// Keep TagLib replaceable outside ASAR for LGPL compliance.
const inventory = new Map();
const bundledInventory = new Map();
for (const input of JSON.parse(await readFile(resolve(root, 'build/bundled-inputs.json'), 'utf8'))) {
  if (!input.includes('node_modules') || input.includes('\0')) continue;
  let directory = dirname(input.split('?')[0]);
  while (directory !== dirname(directory)) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'));
      if (manifest.name && manifest.version) {
        const id = `${manifest.name}@${manifest.version}`;
        if (!bundledInventory.has(id)) {
          bundledInventory.set(id, { name: manifest.name, version: manifest.version, license: manifest.license, repository: manifest.repository });
          const destination = join(notices, id.replaceAll('/', '__'));
          await mkdir(destination, { recursive: true });
          for (const file of await readdir(directory)) {
            if (/^(licen[cs]e|copying|notice)(\.|$|-)/i.test(file)) await cp(join(directory, file), join(destination, file), { recursive: true });
          }
        }
        break;
      }
    } catch { /* Module in a package without its own manifest. */ }
    directory = dirname(directory);
  }
}
await writeFile(join(notices, 'bundled-dependencies.json'), JSON.stringify([...bundledInventory.values()], null, 2));
async function copyPackage(name, from, targetModules, ancestors = new Set()) {
  const sourceRequire = createRequire(join(from, 'package.json'));
  let source;
  try { source = dirname(sourceRequire.resolve(`${name}/package.json`)); }
  catch {
    let candidate = dirname(sourceRequire.resolve(name));
    while (candidate !== dirname(candidate)) {
      try { if (JSON.parse(await readFile(join(candidate, 'package.json'), 'utf8')).name === name) { source = candidate; break; } } catch {}
      candidate = dirname(candidate);
    }
  }
  if (!source) throw Error(`Cannot locate runtime dependency ${name}`);
  if (ancestors.has(source)) return;
  const pkg = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  inventory.set(`${pkg.name}@${pkg.version}`, { name: pkg.name, version: pkg.version, license: pkg.license, repository: pkg.repository });
  const target = join(targetModules, name);
  await cp(source, target, { recursive: true, filter: file => !relative(source, file).split(/[\\/]/).includes('node_modules') });
  const next = new Set(ancestors).add(source);
  for (const dependency of Object.keys(pkg.dependencies ?? {})) await copyPackage(dependency, source, join(target, 'node_modules'), next);
}
await copyPackage('node-taglib-sharp', root, join(stage, 'node_modules'));
await writeFile(join(notices, 'runtime-dependencies.json'), JSON.stringify([...inventory.values()], null, 2));
await writeFile(join(stage, 'package.json'), JSON.stringify({
  name: 'mmplayer-desktop', version: metadata.version, productName: 'MMPlayer',
  description: 'MMPlayer music player — Windows beta', author: 'Pepe Escalera', license: 'MIT',
  homepage: 'https://mmplayer.pescalerag.com', main: 'main.cjs',
  dependencies: { 'node-taglib-sharp': metadata.dependencies['node-taglib-sharp'] },
}, null, 2));
// Never package an injected sheet-audit renderer.
async function checkRenderer(directory) {
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name);
    if (item.isDirectory()) await checkRenderer(path);
    else if (item.name.endsWith('.js') && /__runSheetAudit|__sheetAuditDriver/.test(await readFile(path, 'utf8'))) throw Error('Test renderer cannot be shipped');
  }
}
await checkRenderer(join(stage, 'renderer'));
await new Promise((res, rej) => {
  const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [resolve(root, 'scripts/installer-assets.cjs')], { cwd: root, env, windowsHide: true, stdio: 'inherit' });
  child.on('error', rej); child.on('exit', code => code === 0 ? res() : rej(Error('Installer asset generation failed')));
});
const artifacts = await build({ projectDir: root, config, targets: Platform.WINDOWS.createTarget(['nsis'], 1), publish: 'never' });
const files = artifacts.filter(file => /\.(exe|blockmap)$/.test(file));
const checksums = [];
for (const file of files) {
  const digest = createHash('sha256').update(await readFile(file)).digest('hex');
  checksums.push(`${digest}  ${relative(resolve(root, 'release'), file)}`);
}
await writeFile(resolve(root, 'release', `SHA256SUMS${preview ? '-UNSIGNED-PREVIEW' : ''}.txt`), checksums.join('\n') + '\n');
console.log(preview ? 'UNSIGNED PREVIEW: local testing only.' : unsignedBeta ? 'Unsigned public beta built as explicitly requested. Windows may show SmartScreen warnings.' : 'Signed beta installer built. Run packaged tests and verify signatures before publishing.');
