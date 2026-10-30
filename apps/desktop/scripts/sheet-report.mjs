import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export function finalizeSheetReport(raw) {
  const report = structuredClone(raw);
  // Replace initial inventory placeholders only with the outcome of an actual
  // operation. In particular, sharing availability is not an export test.
  for (const row of report.results) {
    let supporting;
    if (['Compartir', 'Compartir selección como ZIP', 'Exportar archivo .LRC'].includes(row.option))
      supporting = report.results.find(other => other.sheet === row.sheet && other.option === 'ALL: archivo fisico ' + row.option);
    if (row.status === 'unverified' && /^(Fijar|Desfijar)/.test(row.option))
      supporting = report.results.find(other => other.sheet === row.sheet && other.option === 'ALL: fijar y desfijar desde el mismo menu');
    if (row.sheet === 'lyrics-menu' && ['Editar letras', 'Sincronizar letras'].includes(row.option)) {
      const option = row.option === 'Editar letras'
        ? 'REPAIR: editar guardar reabrir y proteger cambios'
        : 'REPAIR: sincronizar marcar deshacer reiniciar y guardar LRC';
      supporting = report.results.find(other => other.sheet === 'lyrics-documents' && other.option === option);
    }
    if (supporting) {
      row.status = supporting.status;
      row.detail = supporting.detail + ' (evidencia: ' + supporting.option + ')';
      if (supporting.evidenceRun) row.evidenceRun = supporting.evidenceRun;
    }
  }
  report.summary = Object.fromEntries(['pass', 'fail', 'unverified'].map(status => [status, report.results.filter(row => row.status === status).length]));
  report.interactionSummary = {
    total: report.interactions?.length || 0,
    clicks: report.interactions?.filter(row => row.event === 'click').length || 0,
    electronEvents: report.interactions?.filter(row => row.trusted).length || 0,
    rootTypes: report.catalog?.length || 0,
    testedSurfaces: [...new Set(report.results.map(row => row.sheet))].sort(),
  };
  return report;
}
export function sheetReportMarkdown(report) {
  const s = report.summary, counts = report.interactionSummary;
  const lines = [
    '# Auditoría de sheets y subniveles de MMPlayer PC', '',
    `Resultado: **${s.pass} correctas, ${s.fail} fallidas y ${s.unverified} sin verificar**.`, '',
    `${counts.rootTypes} tipos contrastados con el registro de la app; ${counts.total} eventos registrados (${counts.clicks} clics).`, '',
    report.scope, '',
    '## Repetir', '',
    '```powershell', 'npm run desktop:test:sheets', '```', '',
    'Subconjunto de subniveles:', '', '```powershell', 'npm run test:sheets --workspace=@mmplayer/desktop -- --filter "ALL:"', '```', '',
    'La ejecución usa un perfil y archivos desechables. El build normal se restaura al terminar. Un fallo de la app mantiene el resultado fallido; abrir un menú solo verifica esa transición. Las operaciones se comprueban en casos propios. Los eventos confiables son entrada nativa de Electron; el resto son eventos DOM del driver.', '',
    '## Fallos', '', '| Sheet o subnivel | Opción | Evidencia |', '|---|---|---|',
  ];
  const cell = value => String(value).replaceAll('|', '/').replaceAll('\n', ' ');
  for (const row of report.results.filter(row => row.status !== 'pass')) lines.push(`| ${cell(row.sheet)} | ${cell(row.option)} | ${cell(row.detail)} |`);
  lines.push('', '## Límites de la comprobación', '',
    '- Los selectores reciben archivos de prueba mediante File/DataTransfer y el destino del diálogo de guardar se redirige al directorio de la auditoría. SQLite, escritura de etiquetas de audio, ZIP, almacenamiento, motor y capturas son reales.',
    '- Las búsquedas externas usan el proveedor real; un 404 solo confirma la búsqueda y la gestión de ausencia. No equivale a descargar unas letras que sí existan. Los casos adicionales de prefetch usan respuestas controladas y lo indican en su evidencia.',
    '- Los temporizadores se activan en cada intervalo y se cancelan; no se espera una hora por cada opción.',
    '- Se prueban los controles disponibles en PC y sus estados relevantes. Las opciones exclusivas de Android y los equipos externos que no estén conectados no se certifican.',
    '- Los recuentos corresponden a casos de prueba; un caso puede incluir varias pulsaciones, y un mismo fallo puede afectar a varios casos.', '',
    '## Todos los resultados', '', '| Sheet o subnivel | Opción | Resultado | Evidencia |', '|---|---|---|---|');
  for (const row of report.results) lines.push(`| ${cell(row.sheet)} | ${cell(row.option)} | ${row.status} | ${cell(row.detail)} |`);
  if (report.sourceRuns) {
    lines.push('', '## Ejecuciones de evidencia', '', 'La pasada completa se complementa con recomprobaciones tras ajustar el test o corregir la app. Los informes originales se conservan; cada resultado recomprobado identifica su ejecución en el JSON.', '');
    for (const run of report.sourceRuns) lines.push(`- [Informe original](${run.replaceAll('\\', '/')})`);
  }
  return lines.join('\n') + '\n';
}
export async function saveSheetReport(path, publish = false) {
  const report = finalizeSheetReport(JSON.parse(await readFile(path, 'utf8')));
  await writeFile(path, JSON.stringify(report, null, 2));
  await writeFile(resolve(dirname(path), 'report.md'), sheetReportMarkdown(report));
  if (publish) {
    const docs = resolve(import.meta.dirname, '../../../docs/qa');
    await writeFile(resolve(docs, 'desktop-sheets-audit.json'), JSON.stringify(report, null, 2));
    await writeFile(resolve(docs, 'desktop-sheets-audit.md'), sheetReportMarkdown(report));
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  let path = resolve(process.argv[2]);
  const merges = process.argv.flatMap((arg, index) => arg === '--merge' ? [resolve(process.argv[index + 1])] : []);
  if (merges.length) {
    const raw = JSON.parse(await readFile(path, 'utf8'));
    raw.sourceRuns = [path, ...merges];
    const cases = new Map(raw.results.map(row => [row.sheet + ':' + row.option, row]));
    for (const run of merges) {
      const extra = JSON.parse(await readFile(run, 'utf8'));
      for (const row of extra.results) cases.set(row.sheet + ':' + row.option, { ...row, evidenceRun: run });
      raw.interactions = [...raw.interactions, ...extra.interactions];
    }
    raw.results = [...cases.values()];
    const outputIndex = process.argv.indexOf('--output');
    if (outputIndex < 0) throw Error('Merged reports require an explicit --output to preserve original evidence');
    path = resolve(process.argv[outputIndex + 1]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(raw, null, 2));
  }
  const report = await saveSheetReport(path, process.argv.includes('--publish'));
  console.log(JSON.stringify({ ...report.summary, ...report.interactionSummary }));
}
