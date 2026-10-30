import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = resolve(import.meta.dirname, '..');
const repo = resolve(root, '../..');
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
assert(/^\d+\.\d+\.\d+-beta\.\d+$/.test(version), 'Only beta publication is allowed');
const tag = `desktop-v${version}`;
const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }, timeout: 120000 }).trim();
assert.equal(git(['remote', 'get-url', 'origin']), 'https://github.com/pescalerag/mmplayer.git');
const commit = git(['rev-parse', 'HEAD']);
assert.equal(git(['status', '--porcelain', '--untracked-files=no']), '', 'Commit the release source before publication');
const output = resolve(root, 'release');
const report = JSON.parse(await readFile(resolve(output, 'package-test-report.json'), 'utf8'));
// Reports are public release artifacts; strip machine-specific paths.
if (report.signatures) report.signatures = report.signatures.map(item => ({ ...item, file: basename(item.file) }));
assert.equal(report.version, version);
assert(['unsigned-beta', 'signed'].includes(report.publicationMode), 'Never publish a local preview');
assert(report.checks.includes('Uninstall') && report.checks.includes('Reinstall preserves the actual library and preferences'), 'Installer acceptance is incomplete');
const installer = report.artifacts.find(item => item.file.endsWith('.exe') && !item.file.includes('/'));
assert(installer, 'Missing accepted installer');
assert.equal(createHash('sha256').update(await readFile(resolve(output, installer.file))).digest('hex'), installer.sha256, 'Installer changed after acceptance');
const sums = await readFile(resolve(output, 'SHA256SUMS.txt'), 'utf8');
const filenames = [];
for (const line of sums.trim().split(/\r?\n/)) {
  const match = /^([a-f0-9]{64})  ([^/\\]+)$/.exec(line);
  assert(match, 'Invalid checksum manifest');
  assert.equal(createHash('sha256').update(await readFile(resolve(output, match[2]))).digest('hex'), match[1]);
  filenames.push(match[2]);
}
assert(filenames.includes(installer.file));
const notes = await readFile(resolve(repo, `docs/releases/desktop-${version}.md`), 'utf8');
if (report.publicationMode === 'unsigned-beta') assert(notes.includes('sin firma digital pública'), 'Unsigned beta disclosure is required');
if (!process.argv.includes('--publish')) {
  console.log(JSON.stringify({ tag, commit, installer: installer.file, mode: report.publicationMode, ready: true }, null, 2));
  process.exit(0);
}
let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) {
  // Reuse Git's configured credential manager. Never log or write the credential.
  const raw = execFileSync('git', ['-c', 'credential.interactive=false', 'credential', 'fill'], {
    cwd: repo, input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }, timeout: 10000,
  });
  token = raw.split(/\r?\n/).find(line => line.startsWith('password='))?.slice(9);
}
assert(token, 'GitHub authentication is required');
async function api(path, options = {}) {
  const response = await fetch(path.startsWith('https:') ? path : `https://api.github.com/repos/pescalerag/mmplayer${path}`, {
    ...options, headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...options.headers },
    signal: AbortSignal.timeout(180000),
  });
  if (!response.ok) throw Error(`GitHub returned ${response.status} for ${new URL(response.url).pathname}`);
  return response.json();
}
// Only run after the owner explicitly requests a release following their merge.
// This command must never create/push branches or tags on the owner's behalf.
const comparison = await api(`/compare/${commit}...main`);
assert.equal(comparison.merge_base_commit.sha, commit, 'Wait for the owner to merge the source into main');
const remoteTag = await api(`/git/ref/tags/${tag}`);
assert.equal(remoteTag.object.sha, commit, 'An explicitly prepared release tag must point to this commit');
const releases = await api('/releases?per_page=100');
let release = releases.find(item => item.tag_name === tag);
assert(!release || release.draft, 'This beta is already public; do not overwrite released assets');
if (!release) release = await api('/releases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag_name: tag, target_commitish: commit, name: `MMPlayer ${version} · Windows Beta`, body: notes, draft: true, prerelease: true, make_latest: 'false' }) });
const existing = await api(`/releases/${release.id}/assets`);
for (const file of [...filenames, 'SHA256SUMS.txt', 'package-test-report.json']) {
  const body = file === 'package-test-report.json' ? Buffer.from(JSON.stringify(report, null, 2)) : await readFile(resolve(output, file));
  const asset = existing.find(item => item.name === basename(file));
  if (asset) {
    assert.equal(asset.digest, `sha256:${createHash('sha256').update(body).digest('hex')}`, 'Draft asset differs; inspect it before retrying');
    continue;
  }
  await api(`${release.upload_url.split('{')[0]}?name=${encodeURIComponent(basename(file))}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body });
  console.log(`Uploaded ${basename(file)}`);
}
release = await api(`/releases/${release.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draft: false, prerelease: true, make_latest: 'false', body: notes }) });
await writeFile(resolve(output, 'published-release.json'), JSON.stringify({ url: release.html_url, tag, commit, mode: report.publicationMode, assets: filenames }, null, 2));
console.log(`BETA_PUBLISHED ${release.html_url}`);
