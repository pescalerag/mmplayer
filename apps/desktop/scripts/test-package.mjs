import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, readdir, stat, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { listPackage, extractFile } = require('@electron/asar');
const { getCurrentFuseWire, FuseV1Options } = require('@electron/fuses');
const root = resolve(import.meta.dirname, '..');
const output = resolve(root, 'release');
// A failed rerun must not leave an older passing acceptance report publishable.
await rm(resolve(output, 'package-test-report.json'), { force: true });
const exe = resolve(output, 'win-unpacked/MMPlayer.exe');
const archive = resolve(output, 'win-unpacked/resources/app.asar');
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const report = { version, checkedAt: new Date().toISOString(), checks: [], signed: false };
const files = listPackage(archive).map(file => file.replaceAll('\\', '/'));
assert(!files.some(file => /\.map$|[\\/]test[\\/]|__sheetAudit/.test(file)), 'Development files in production package');
assert(files.includes('/main.cjs') && files.includes('/renderer/index.html'), 'Incomplete application');
const pkg = JSON.parse(extractFile(archive, 'package.json'));
assert.equal(pkg.version, version);
assert.equal(pkg.name, 'mmplayer-desktop');
report.checks.push('ASAR contents and beta identity');
const fuses = await getCurrentFuseWire(exe);
assert.equal(fuses[FuseV1Options.RunAsNode], 48);
assert.equal(fuses[FuseV1Options.EnableNodeOptionsEnvironmentVariable], 48);
assert.equal(fuses[FuseV1Options.EnableNodeCliInspectArguments], 48);
assert.equal(fuses[FuseV1Options.OnlyLoadAppFromAsar], 49);
assert.equal(fuses[FuseV1Options.EnableEmbeddedAsarIntegrityValidation], 49);
report.checks.push('Production Electron fuses');
const execute = (command, args, options = {}) => new Promise((res, rej) => {
  const child = spawn(command, args, { stdio: 'inherit', windowsHide: true, ...options });
  const timeout = setTimeout(() => { child.kill(); rej(Error('Package test timed out')); }, 120000);
  child.on('error', error => { clearTimeout(timeout); rej(error); });
  child.on('exit', code => { clearTimeout(timeout); code === 0 ? res() : rej(Error(`Package test exit ${code}`)); });
});
async function smoke(executable, profile) {
  await execute(process.execPath, [resolve(root, 'scripts/smoke.mjs')], { cwd: root, env: { ...process.env, MMPLAYER_TEST_EXECUTABLE: executable, ...(profile ? { MMPLAYER_TEST_PROFILE: profile } : {}) } });
}
await smoke(exe);
report.checks.push('Packaged Electron: real renderer, SQLite worker, audio, metadata writes, menus and persistence');

if (process.argv.includes('--installer')) {
  const installers = (await readdir(output)).filter(file => file.endsWith('.exe') && file.includes(version) && (process.argv.includes('--unsigned-beta') ? /-UNSIGNED\.exe$/.test(file) : true));
  assert.equal(installers.length, 1, 'Expected exactly one installer (remove stale artifacts before testing)');
  const installer = resolve(output, installers[0]);
  report.artifacts = await Promise.all([exe, installer].map(async file => ({ file: file === exe ? 'win-unpacked/MMPlayer.exe' : installers[0], sha256: createHash('sha256').update(await readFile(file)).digest('hex') })));
  const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '$ErrorActionPreference="Stop"; Import-Module (Join-Path $PSHOME "Modules/Microsoft.PowerShell.Security/Microsoft.PowerShell.Security.psd1"); $paths=@($env:MMPLAYER_VERIFY_EXE,$env:MMPLAYER_VERIFY_INSTALLER); @($paths | ForEach-Object { $s=Get-AuthenticodeSignature -LiteralPath $_; @{file=$_;status=$s.Status.ToString();publisher=$s.SignerCertificate.Subject} }) | ConvertTo-Json -Compress'],
  { env: { ...process.env, MMPLAYER_VERIFY_EXE: exe, MMPLAYER_VERIFY_INSTALLER: installer }, windowsHide: true });
  const signatures = JSON.parse(stdout);
  report.signed = signatures.every(s => s.status === 'Valid');
  report.signatures = signatures.map(({status,publisher}, index) => ({file: index === 0 ? 'MMPlayer.exe' : installers[0], status, publisher}));
  report.publicationMode = /-UNSIGNED-PREVIEW\.exe$/.test(installer) ? 'preview' : /-UNSIGNED\.exe$/.test(installer) ? 'unsigned-beta' : 'signed';
  assert(signatures.every(s => ['Valid', 'NotSigned'].includes(s.status)), 'Corrupt or invalid signature');
  if (process.argv.includes('--unsigned-beta')) assert.equal(report.publicationMode, 'unsigned-beta');
  if (process.argv.includes('--require-signed')) assert(report.signed, 'A public release requires valid executable and installer signatures');

  // Never replace an existing real installation. The CI runner is disposable.
  const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ad67e208-0f85-4d1b-af28-406fb811b975';
  let installed = false;
  try { await promisify(execFile)('reg.exe', ['query', key], { windowsHide: true }); installed = true; } catch {}
  assert(!installed, 'An MMPlayer installation already exists; run installer lifecycle tests in a clean Windows account');
  const directory = resolve(root, '../../.tmp/desktop-installer-test', String(Date.now()));
  const target = join(directory, 'MMPlayer install path with spaces');
  const profile = join(directory, 'isolated-profile');
  await mkdir(directory, { recursive: true });
  const knownFolders = JSON.parse((await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    '@{desktop=[Environment]::GetFolderPath("Desktop");programs=[Environment]::GetFolderPath("Programs")} | ConvertTo-Json -Compress'], { windowsHide: true })).stdout);
  assert(knownFolders.desktop && knownFolders.programs, 'Cannot determine user shortcut folders');
  const shortcuts = [join(knownFolders.programs, 'MMPlayer.lnk'), join(knownFolders.desktop, 'MMPlayer.lnk')];
  const originals = await Promise.all(shortcuts.map(path => readFile(path).catch(() => null)));
  let uninstaller;
  let settingsBefore, databaseBefore;
  try {
    await execute(installer, ['/S', `/D=${target}`], { windowsVerbatimArguments: true });
    assert((await stat(join(target, 'MMPlayer.exe'))).size > 0);
    uninstaller = (await readdir(target)).find(file => /^Uninstall.*\.exe$/i.test(file));
    assert(uninstaller, 'Uninstaller is missing');
    await smoke(join(target, 'MMPlayer.exe'), profile);
    report.checks.push('Silent per-user installation with spaces in destination and installed application smoke test');
    // A real reinstall uses the same installed application ID and must preserve data.
    settingsBefore = await readFile(join(profile, 'settings.json'));
    databaseBefore = await readFile(join(profile, 'library.db'));
    await execute(installer, ['/S', `/D=${target}`], { windowsVerbatimArguments: true });
    assert.deepEqual(await readFile(join(profile, 'settings.json')), settingsBefore);
    assert.deepEqual(await readFile(join(profile, 'library.db')), databaseBefore);
    report.checks.push('Reinstall preserves the actual library and preferences');
  } finally {
    try { if (uninstaller) {
      await execute(join(target, uninstaller), ['/S']);
      for (let i = 0; i < 100 && await stat(join(target, 'MMPlayer.exe')).catch(() => null); i++) await new Promise(r => setTimeout(r, 100));
      assert.equal(await stat(join(target, 'MMPlayer.exe')).catch(() => null), null, 'Uninstall did not remove the executable');
      if (settingsBefore) assert.deepEqual(await readFile(join(profile, 'settings.json')), settingsBefore);
      if (databaseBefore) assert.deepEqual(await readFile(join(profile, 'library.db')), databaseBefore);
      report.checks.push('Uninstall');
    } } finally { for (let i = 0; i < shortcuts.length; i++) {
      if (originals[i]) { await mkdir(resolve(shortcuts[i], '..'), { recursive: true }); await writeFile(shortcuts[i], originals[i]); }
      else await rm(shortcuts[i], { force: true });
    } }
  }
}
await writeFile(resolve(output, 'package-test-report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
