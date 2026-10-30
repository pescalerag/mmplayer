import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from './build.mjs';
import { saveSheetReport } from './sheet-report.mjs';

const root = resolve(import.meta.dirname, '..');
// Explicitly control Reanimated's test environment. Production still follows
// the user's accessibility preference; no OS setting is modified here.
const motionMode = process.env.MMPLAYER_SHEET_MOTION_MODE || 'never';
const motionModes = { never: 'Never', always: 'Always', system: 'System' };
if (!Object.hasOwn(motionModes, motionMode)) throw Error('Invalid test motion mode');
const sheetSource = await readFile(resolve(root, '../../src/store/useUIStore.ts'), 'utf8');
const sheetUnion = sheetSource.match(/export type SheetType\s*=([\s\S]*?);/)?.[1];
if (!sheetUnion) throw Error('No se puede leer el registro de sheets');
const expectedSheets = [...sheetUnion.matchAll(/'([^']+)'/g)].map(match => match[1]);
const output = resolve(root, '../../.tmp/desktop-sheets', String(Date.now()));
await mkdir(resolve(output, 'music'), { recursive: true });
for (const ext of ['mp3', 'flac']) await copyFile(resolve(root, 'test/fixtures/tone.' + ext), resolve(output, 'music/Sheet audit.' + ext));
// The audit bridge is injected only in this test build; normal builds expose no test API.
await build({ rendererPlugins: [{
  name: 'sheet-integration-entry', enforce: 'pre',
  transform(source, id) {
    if (id.replaceAll('\\', '/').endsWith('/src/renderer/main.tsx')) {
      const marker='createRoot(document.getElementById("root")!).render(';
      if (!source.includes(marker)) throw Error('Review sheet audit root recovery injection');
      return source.replace(marker,`const sheetTestRoot = createRoot(document.getElementById("root")!);
        function SheetMotionControl() {
          const [mode, setMode] = React.useState(ReduceMotion.System);
          window.__sheetSetMotionMode = setMode;
          React.useEffect(() => { window.__sheetAppliedMotionMode = mode; }, [mode]);
          return <ReducedMotionConfig mode={mode} />;
        }
        const renderSheetAudit = element => sheetTestRoot.render(<><SheetMotionControl />{element}</>);
        renderSheetAudit(`) + `
        import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
        import "../../test/sheets/renderer";
        window.__sheetMotionMode = ${JSON.stringify(motionMode)};
        window.__sheetAuditRecover = () => renderSheetAudit(
          <ErrorBoundary key={Date.now()}><I18nextProvider i18n={i18n}><App /></I18nextProvider></ErrorBoundary>
        );`;
    }
  },
}] });
const env = { ...process.env, MMPLAYER_SHEET_AUDIT_OUTPUT: output, MMPLAYER_DESKTOP_DATA: resolve(output, 'profile'), MMPLAYER_DESKTOP_SMOKE_AUDIO: resolve(output, 'music') };
env.MMPLAYER_SHEET_AUDIT_TYPES = JSON.stringify(expectedSheets);
delete env.ELECTRON_RUN_AS_NODE;
const require = createRequire(import.meta.url);
const filterIndex=process.argv.indexOf('--filter');
if(filterIndex>=0) env.MMPLAYER_SHEET_AUDIT_FILTER=process.argv[filterIndex+1];
const child = spawn(require('electron'), [resolve(root, 'test/sheets/main.cjs')], { env, stdio: 'inherit', windowsHide: true });
const timeout = setTimeout(() => { child.kill(); process.exitCode = 1; }, 1200000);
child.on('exit', async code => {
  clearTimeout(timeout);
  console.log('Sheet audit artifacts:', output);
  console.log('Electron exit:', code);
  try {
    const report = await saveSheetReport(resolve(output, 'report.json'), !env.MMPLAYER_SHEET_AUDIT_FILTER);
    console.log(JSON.stringify(report.summary));
    process.exitCode = report.summary.fail || report.summary.unverified ? 1 : (code ?? 1);
  } catch { console.error('Sheet audit did not produce a complete report.'); process.exitCode = 1; }
  // Do not leave the renderer's test bridge in the normal desktop build.
  try { await build(); }
  catch (error) { console.error('Could not restore normal desktop build:', error); process.exitCode = 1; }
});
