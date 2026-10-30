// @ts-nocheck -- Integration driver runs against the actual Chromium DOM.
import { runFooterFunctions } from './footerFunctions';
import { runLyricsLayout } from './lyricsLayout';
import { runMissingAndDetails } from './missingAndDetails';
import { runSidebarNavigation } from './sidebarNavigation';
import { runDiscordPresence } from './discordPresence';
import { runContextMenus } from './contextMenus';
import { runDesktopSettings } from './desktopSettings';
import { runQueueVirtualization } from './queueVirtualization';
import { runPlayerAppearance } from './playerAppearance';
import { runLyricsRepairs } from './lyricsRepairs';
import { runAllOptions } from './allOptions';
import { useQueueRenameModalStore } from '../../../../src/store/useQueueRenameModalStore';
import { useCustomDateModalStore } from '../../../../src/store/useCustomDateModalStore';
import { BackupService } from '../../../../src/services/BackupService';
import { useBackupStore } from '../../../../src/store/useBackupStore';
import { createBackupArchive, openBackupArchive, stageArchiveAssets } from '../../../../src/services/BackupArchiveService';
import { BACKUP_TABLES, validateBackupData } from '../../../../src/utils/backupData';
import { remapDesktopBackup } from '../../src/renderer/ports/backupPaths';
import * as FileSystem from '../../src/renderer/ports/fileSystem';
import RNRestart from '../../src/renderer/ports/restart';
import * as ui from '../../../../src/store/useUIStore';
import { database } from '../../src/renderer/ports/database';
import { desktopMenus } from '../../src/renderer/desktopMenus';
import { player } from '../../src/renderer/player';
import { usePlayerStore } from '../../src/renderer/ports/playerStore';
import { useSleepTimerStore } from '../../src/renderer/ports/sleepTimer';
import { useSettingsStore } from '../../../../src/store/useSettingsStore';
import { useLibraryStore } from '../../../../src/store/useLibraryStore';
import { useMultiSelectStore } from '../../../../src/store/useMultiSelectStore';
import { useTagFormStore } from '../../../../src/store/useTagFormStore';
import { useColorPickerModalStore } from '../../../../src/store/useColorPickerModalStore';
import { MetadataEditorService } from '../../src/renderer/ports/metadataEditor';
import * as Sharing from 'expo-sharing';
import { MediaAssetService } from '../../../../src/services/MediaAssetService';

import { StorageService } from '../../../../src/services/StorageService';
import { readLibraryFileSizes } from '../../../../src/services/LibraryFilterService';
import { EMPTY_SECTION_FILTERS, emptyLibraryFilterIndex, matchesFolderFilters } from '../../../../src/utils/libraryFilters';
import { checkFilesExistOnDisk, getStorageStats, resolveAudioUriInfo } from '../../src/renderer/ports/audioFiles';

import { LyricsService } from '../../../../src/services/LyricsService';
import { LyricsSyncService } from '../../../../src/services/LyricsSyncService';

import { navigationRef } from '../../src/renderer/ports/navigationRef';
import { captureRef } from '../../src/renderer/ports/viewShot';

import { NotificationService } from '../../../../src/services/NotificationService';
import { ScannerService } from '../../src/renderer/ports/scannerService';
import { useNotificationStore } from '../../../../src/store/useNotificationStore';
import { getPreviousWeekRange, getPreviousMonthRange, getPreviousYearRange } from '../../../../src/utils/notificationHelpers';

const wait = (ms = 120) => new Promise(resolve => setTimeout(resolve, ms));
const bounded = (promise, label, ms = 5000) => Promise.race([promise, wait(ms).then(() => { throw Error('Timeout: ' + label); })]);
const clean = (text = '') => String(text ?? '').replace(/[\uE000-\uF8FF]/g, '').replace(/\s+/g, ' ').trim();
const assert = (condition, message) => { if (!condition) throw Error(message); };
const buttons = (root = document) => [...root.querySelectorAll('*')].filter(el => el.matches('button,[role="button"],input,[role="radio"],[role="switch"],textarea,[tabindex="0"]') || Object.keys(el).some(key => key.startsWith('__reactProps$') && typeof el[key]?.onClick === 'function'));
const label = el => clean(el.getAttribute('aria-label') || el.innerText || el.placeholder || el.type || el.tagName);
const menu = type => [...document.querySelectorAll(`[data-desktop-menu-type="${type}"]`)].at(-1);
let specs, models;
const results = [];
const errors = [];
const interactions = [];
let activeCase = null;
for(const kind of ['click','input','change','dragend'])document.addEventListener(kind,event=>{
  if(!activeCase)return;
  const target=event.target instanceof Element?event.target.closest('button,[role="button"],[role="switch"],[role="radio"],[role="slider"],input,textarea,[draggable="true"]'):null;
  if(!target)return;
  const sheet=target.closest('[data-desktop-menu-type]');
  interactions.push({case:activeCase,event:kind,sheet:sheet?.getAttribute('data-desktop-menu-type') || (target.closest('[data-desktop-modal-layer]')?'modal':target.closest('[data-testid="desktop-queue-sheet"]')?'queue':'screen'),label:label(target),testId:target.getAttribute('data-testid'),trusted:event.isTrusted,checked:target.checked,value:target.value});
},true);
window.addEventListener('error', e => errors.push(String(e.error || e.message)));
window.addEventListener('unhandledrejection', e => errors.push(String(e.reason)));
function record(sheet, option, status, detail) {
  const row = { sheet, option, status, detail }; results.push(row);
  console.log('SHEET_AUDIT ' + JSON.stringify(row));
}
async function test(sheet, option, run, timeout = 15000) {
  if(window.__sheetCaseFilter && !new RegExp(window.__sheetCaseFilter,'i').test(sheet+' '+option))return;
  const before = errors.length;
  activeCase = sheet+":"+option;
  try { const detail = await bounded(Promise.resolve().then(run), sheet + ': ' + option, timeout); assert(errors.length === before, errors.slice(before).join('; ')); record(sheet, option, 'pass', detail || 'Comprobación completada'); }
  catch (e) {
    console.log('SHEET_AUDIT_STACK '+String(e.stack||e));
    record(sheet, option, e.unverified ? 'unverified' : 'fail', errors.slice(before).join('; ') || String(e.message || e));
    if (!document.querySelector('[data-testid="desktop-shell"]')) {
      console.log('SHEET_AUDIT Recovering after '+sheet+': '+option);
      window.__sheetAuditRecover();
      await wait(400);
      await until(()=>document.querySelector('[data-testid="desktop-shell"] .sidebar'), 'No se recupera la app');
      await wait(700);
    }
  }
}
async function reset() {
  useQueueRenameModalStore.getState().close();useCustomDateModalStore.getState().close();
  desktopMenus.clear(); useTagFormStore.getState().closeForm(); useColorPickerModalStore.getState().close();
  document.querySelector('[data-testid="queue-close"]')?.click();
  // Dismiss only test alerts; never answer OS dialogs.
  for (let i = 0; i < 4; i++) {
    const el = buttons().find(el => /^(Cancelar|OK|Aceptar)$/.test(label(el)) && !el.closest('[data-desktop-menu-id]') && !el.closest('.window-titlebar'));
    if (!el) break; el.click(); await wait();
  }
  await wait();
  const home=document.querySelector('.sidebar nav button'); if(home){ home.click(); await wait(100); }
}
async function open(type, props = specs[type]) {
  await reset(); ui.useUIStore.getState().openSheet(type, props); await wait(250);
  return menu(type);
}
async function click(type, text) {
  const root = [...document.querySelectorAll(`[data-desktop-menu-type="${type}"]`)].at(-1); assert(root, 'Sheet no visible: ' + type);
  const el = buttons(root).find(el => typeof text === 'string' ? label(el) === text : text.test(label(el)));
  assert(el, 'No se encuentra la opción: ' + text);
  assert(!el.disabled && el.getAttribute('aria-disabled') !== 'true', 'Opción deshabilitada');
  el.scrollIntoView({ block: 'nearest' });
  if(type==='tag-manager') {
    await wait(80);const r=el.getBoundingClientRect();const id=String(Date.now());
    console.log('SHEET_INPUT '+JSON.stringify({id,x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}));
    await until(()=>window.__sheetInputDone===id,'No llega entrada de ratón');
  }else el.click();
  await wait(350); return el;
}
function setInput(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
}
async function until(fn, message) {
  for(let i = 0; i < 80; i++) { if (fn()) return; if(!document.querySelector('[data-testid="desktop-shell"]')) throw Error(document.querySelector('[role="alert"]')?.innerText||'La app se ha desmontado'); await wait(75); }
  throw Error(message);
}
function state() {
  return JSON.stringify({ settings: useSettingsStore.getState(), library: useLibraryStore.getState(), player: player.getSnapshot(), selection: useMultiSelectStore.getState().selectedTracks.map(t=>t.id), raw: Object.fromEntries(Object.entries(models).map(([k,v]) => [k,v?._raw])) }, (k,v) => typeof v === 'function' ? undefined : v);
}

async function runActions(inventory) {
  const track = models.track;
  const qsize = () => player.getSnapshot().queues[player.getSnapshot().activeQueue].trackIds.length;
  const raw = model => JSON.stringify(model._raw);
  const covered = new Set();
  const mark = (sheet, option) => covered.add(sheet + ':' + option);
  const action = async (sheet, option, fn) => { mark(sheet, option); await test(sheet, option, async () => { await open(sheet); return await fn(); }); };
  const globalClick = async text => { const el=buttons().find(e=>text.test(label(e)) && !e.closest('.window-titlebar')); assert(el,'No aparece '+text);el.click();await wait(350); };
  const menuTypes = ['track-menu','album-menu','artist-menu','folder-menu','playlist-menu','batch-menu','tag-menu','lyrics-menu'];
  for(const sheet of menuTypes) {
    const entry=inventory.find(x=>x.type===sheet); if(!entry)continue;
    for(const option of entry.controls.filter(c=>c.role==='button').map(c=>c.label)) {
      if(option==='Cancelar') { await action(sheet,option,async()=>{await click(sheet,option);assert(!menu(sheet),'La sheet no se cierra');}); continue; }
      if(/Importar|Exportar|internet|imagen de CD|Compartir/.test(option)) {mark(sheet,option);record(sheet,option,'unverified','Requiere selector de archivos, servicio externo o compartir; no se considera validado por abrir la sheet.');continue;}
      if(/Excluir canción|Excluir del escaneo|Eliminar Etiqueta|Eliminar letras/.test(option)) {
        await action(sheet,option+' — confirmación y cancelación',async()=>{
          await click(sheet,option);await wait(180);
          assert(buttons().some(e=>label(e)==='Cancelar' && !e.closest('[data-desktop-menu-id]')),'No se muestra confirmación');
          await globalClick(/^Cancelar$/);return 'La confirmación se muestra; cancelar conserva los datos';
        });mark(sheet,option);record(sheet,option,'unverified','Operación destructiva final pendiente; se ha probado la confirmación y su cancelación.');continue;
      }
      await action(sheet,option,async()=>{
        if(/Añadir a continuación|Añadir al final/.test(option)) {const before=qsize();await click(sheet,option);await until(()=>qsize()>before,'La cola no recibe canciones');return 'La cola crece y contiene la pista de prueba';}
        if(/cola distinta/.test(option)){await click(sheet,option);assert(menu('queue-destination'),'No abre selector de cola');return 'Abre queue-destination con las pistas';}
        if(/Gestionar etiquetas/.test(option)){await click(sheet,option);assert(menu('tag-manager'),'No abre tag-manager');return;}
        if(/playlist/.test(option)&&!/^Ver/.test(option)){await click(sheet,option);assert(menu('playlist-selector'),'No abre playlist-selector');return;}
        if(/Metadatos/.test(option)){await click(sheet,option);assert(menu('metadata-editor'),'No abre metadata-editor');return;}
        if(/Canvas/.test(option)){await click(sheet,option);assert(menu('canvas-manager'),'No abre canvas-manager');return;}
        if(/Propiedades/.test(option)){await click(sheet,option);assert(menu('track-details'),'No abre propiedades');return;}
        if(/Seleccionar/.test(option)){useMultiSelectStore.getState().exitSelectionMode();await click(sheet,option);await until(()=>useMultiSelectStore.getState().selectedTracks.some(t=>t.id===track.id),'No se seleccionan las canciones');return 'La selección contiene la pista';}
        if(/favoritos/.test(option)){if(sheet==='batch-menu'){await database.write(()=>track.update(t=>{t.isFavorite=false;}));await open(sheet);}const before=track.isFavorite;await click(sheet,option);await until(()=>track.isFavorite!==before,'No cambia favorito');return 'Estado favorito actualizado en el modelo';}
        if(/aleatori/.test(option)){const model=sheet==='album-menu'?models.album:track;if(sheet==='batch-menu'){await database.write(()=>track.update(t=>{t.isExcludedFromShuffle=false;}));await open(sheet);}const before=raw(model);await click(sheet,option);await until(()=>raw(model)!==before,'No cambia exclusión de aleatorio');return 'Modelo persistido actualizado';}
        if(/Fijar/.test(option)){if(sheet==='tag-menu'||sheet==='folder-menu'){const before=JSON.stringify((await window.mmplayer.invoke('state')).preferences.pinnedShortcuts);await click(sheet,option);await wait(150);assert(JSON.stringify((await window.mmplayer.invoke('state')).preferences.pinnedShortcuts)!==before,'No guarda acceso fijado');return 'Acceso fijado persistido';}const model=sheet==='album-menu'?models.album:sheet==='artist-menu'?models.artist:models.playlist;const before=model.isPinned;await click(sheet,option);await until(()=>model.isPinned!==before,'No cambia fijado');return 'isPinned actualizado';}
        if(/^Ver artista/.test(option)){await click(sheet,option);await until(()=>document.querySelector('[data-testid="mobile-screen-ArtistDetail"]'),'No navega a artista');return;}
        if(/^(Ver|Ir a) álbum/.test(option)){await click(sheet,option);await until(()=>document.querySelector('[data-testid="mobile-screen-AlbumDetail"]'),'No navega a álbum');return;}
        if(/^Ver playlist/.test(option)){await click(sheet,option);await until(()=>document.querySelector('[data-testid="mobile-screen-PlaylistDetail"]'),'No navega a playlist');return;}
        if(option==='Configurar saltos'){await click(sheet,option);await until(()=>document.querySelector('[data-testid="mobile-screen-TimestampsEditor"]'),'No abre editor de saltos');return;}
        if(option==='Editar etiqueta'){await click(sheet,option);assert(useTagFormStore.getState().isVisible,'No abre formulario de etiqueta');return;}
        if(option==='Editar letras'||option==='Sincronizar letras'){await click(sheet,option);const name=option==='Editar letras'?'LyricsEditor':'LyricsSync';await until(()=>document.querySelector(`[data-testid="mobile-screen-${name}"]`),'No navega a '+name);return;}
        if(option==='Más info'){await click(sheet,option);await until(()=>menu('track-menu'),'No abre menú de canción');return 'Abre menú de la canción';}
        throw Error('Falta una aserción específica para esta opción');
      });
    }
  }
  for(const [minutes,option] of [[5,'5 min'],[10,'10 min'],[20,'20 min'],[30,'30 min'],[45,'45 min'],[60,'1 hora']]) {
    useSleepTimerStore.getState().deactivate();
    await action('sleep-timer',option,async()=>{await click('sleep-timer',option);const s=useSleepTimerStore.getState();assert(s.isActive&&s.timeLeft>=minutes*60-1,'Temporizador incorrecto');await click('sleep-timer',/Desactivar/);assert(!useSleepTimerStore.getState().isActive,'No se desactiva');return `Activa ${minutes} minutos y se cancela`;});
  }
  const swipeValues=['add_next','add_last','add_to_playlist','toggle_favorite','none'];
  for(const [i,option] of ['Añadir a continuación','Añadir a la cola','Añadir a playlist','Alternar favorito','Ninguna'].entries()) for(const target of ['left','right']) {
    await test('swipe-action',option+' ('+target+')',async()=>{await open('swipe-action',{target});await click('swipe-action',option);assert(useSettingsStore.getState()[target==='left'?'swipeLeftAction':'swipeRightAction']===swipeValues[i],'No guarda el gesto');});mark('swipe-action',option);
  }
  await action('artists-list',models.artist.name,async()=>{await click('artists-list',models.artist.name);assert(document.querySelector('[data-testid="mobile-screen-ArtistDetail"]'),'No abre el artista');});
  for(let id=1;id<5;id++)await action('queue-destination','Cola '+(id+1),async()=>{const before=player.getSnapshot().queues[id].trackIds.length;await click('queue-destination','Cola '+(id+1));await until(()=>player.getSnapshot().queues[id].trackIds.length>before,'No añade a cola '+id);});
  for(const [option,key,value] of [
    ['Carátula Original','playerCoverStyle','cover'],['CD Giratorio','playerCoverStyle','cd'],['Vinilo Giratorio','playerCoverStyle','vinyl'],['Casete','playerCoverStyle','cassette'],
    ['Carátula Difuminada','playerBackgroundStyle','cover'],['Degradado de Color','playerBackgroundStyle','gradient'],
    ['Barras de Ecualizador','playerVisualizerType','bars'],['Onda Oscilante','playerVisualizerType','wave'],['Espectro Completo','playerVisualizerType','spectrum'],['Círculo Pulsante','playerVisualizerType','circle'],
    ['Adaptarse a Portada','playerVisualizerColorMode','cover'],['Color de acento','playerVisualizerColorMode','accent'],['Arcoíris','playerVisualizerColorMode','rainbow'],
  ])await action('player-menu',option,async()=>{await click('player-menu',option);assert(useSettingsStore.getState()[key]===value,`${key} no cambia a ${value}`);return `${key}=${value}`;});
  await action('player-menu','Color personalizado',async()=>{await click('player-menu','Color personalizado');assert(useColorPickerModalStore.getState().request,'No abre selector de color');return 'Abre el selector de color';});
  for(const [option,key] of [['Mostrar nombre del álbum en casete','showCassetteAlbumName'],['Mostrar Canvas','showCanvas'],['Visualizador Activo','showPlayerVisualizer']])await action('player-menu',option,async()=>{const before=useSettingsStore.getState()[key];await click('player-menu',option);await until(()=>useSettingsStore.getState()[key]!==before,'El interruptor no modifica '+key);});
  await action('edit-alias','Guardar alias',async()=>{const input=menu('edit-alias').querySelector('input');setInput(input,'Auditoría desktop');await wait();await click('edit-alias','Guardar alias');assert(useSettingsStore.getState().userAlias==='Auditoría desktop','No guarda el alias');});
  await action('tag-manager','Sheet audit tag',async()=>{const before=(await track.queryTags.fetch()).some(t=>t.id===models.tag.id);await click('tag-manager','Sheet audit tag');await wait(350);assert((await track.queryTags.fetch()).some(t=>t.id===models.tag.id)!==before,'No cambia asociación de etiqueta');});
  await action('tag-manager','Crear nueva etiqueta',async()=>{await click('tag-manager','Crear nueva etiqueta');assert(useTagFormStore.getState().isVisible,'No abre formulario');});
  await action('playlist-selector','Crear nueva playlist',async()=>{await click('playlist-selector','Crear nueva playlist');const input=menu('playlist-selector')?.querySelector('input');assert(input,'No aparece formulario de creación');setInput(input,'Playlist creada por integración');await wait();await click('playlist-selector',/^Crear playlist$|^Crear$|^Guardar$/i);await wait(350);const lib=await window.mmplayer.invoke('library');assert(lib.playlists.some(p=>p.name==='Playlist creada por integración'),'No crea la playlist');});
  await action('playlist-selector','Sheet audit playlist Sin descripción',async()=>{await click('playlist-selector',/^Sheet audit playlist/);await wait();const confirmation=buttons().find(e=>/^Añadir todas$|^Añadir$/.test(label(e))&&!e.closest('[data-desktop-menu-id]'));assert(confirmation,'No muestra confirmación de duplicado');confirmation.click();await wait(350);const links=await models.playlist.tracks?.fetch?.();const lib=await window.mmplayer.invoke('library');assert(lib.playlists.some(p=>p.id===models.playlist.id),'Playlist desaparecida');return 'Selecciona playlist y confirma adición';});
  for(const sheet of ['library-tabs-order','app-tabs-order','home-sections'])await test(sheet,'Reordenar y guardar',async()=>{
    const root=await open(sheet);const rows=[...root.querySelectorAll('[draggable="true"]')];assert(rows.length>=2,'No hay filas arrastrables');
    const key=sheet==='home-sections'?'homeSectionsOrder':sheet==='app-tabs-order'?'appTabsOrder':'libraryTabsOrder';const before=[...useSettingsStore.getState()[key]];
    rows[0].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:new DataTransfer()}));await wait();rows[1].dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer:new DataTransfer()}));rows[1].dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:new DataTransfer()}));await wait();
    await click(sheet,sheet==='home-sections'?'Listo':'Confirmar y Reiniciar');await wait(250);assert(JSON.stringify(useSettingsStore.getState()[key])!==JSON.stringify(before),'Orden no guardado');return 'Arrastre DOM y persistencia del orden comprobados';
  });
  for(const sheet of ['notification-settings','home-sections'])await test(sheet,'Interruptores y guardar',async()=>{await open(sheet);const inputs=[...menu(sheet).querySelectorAll('input[type="checkbox"]')];assert(inputs.length,'No hay interruptores');const before=JSON.stringify(useSettingsStore.getState());for(const input of inputs){input.click();await wait(25);}await click(sheet,sheet==='home-sections'?'Listo':'Guardar preferencias');assert(JSON.stringify(useSettingsStore.getState())!==before,'No persiste preferencias');return `${inputs.length} interruptores modificados y guardados`;});
  await action('advanced-tag-search','Sheet audit tag',async()=>{await click('advanced-tag-search','Sheet audit tag');await click('advanced-tag-search','Buscar');assert(window.__sheetSearchResult?.includes.includes(models.tag.id),'No envía etiqueta incluida');});
  await action('advanced-tag-search','Borrar todo',async()=>{await click('advanced-tag-search','Sheet audit tag');await click('advanced-tag-search','Borrar todo');await click('advanced-tag-search','Buscar');assert(window.__sheetSearchResult?.includes.length===0&&window.__sheetSearchResult?.excludes.length===0,'No limpia filtros');});
  await extraActions(action,mark,test);
  await action('clear-queue','Parar la reproducción',async()=>{await click('clear-queue','Parar la reproducción');await until(()=>!player.getSnapshot().track,'No detiene/limpia reproductor');});
  await finalActions(test);
  // Every discovered control is accounted for, including icon-only controls.
  for(const [sheet,labels] of Object.entries({
    'library-tabs-order':['Confirmar y Reiniciar'], 'app-tabs-order':['Inicio','Biblioteca','Buscar','Etiquetas','Actividad','Confirmar y Reiniciar'],
    'home-sections':['Listo'],'metadata-editor':['Guardar'],'advanced-tag-search':['Buscar'],'notification-settings':['Guardar preferencias'],
    'sort-modal':['Ordenar por','Todos','Sí','No','Duración','Valoración','Género','Formatos','Limpiar filtros','Aplicar'],
    'clear-queue':['Borrar contexto'],
  }))for(const option of labels)mark(sheet,option);
  for(const entry of inventory)for(const c of entry.controls){
    if(c.label==='Cancelar'||covered.has(entry.type+':'+c.label))continue;
    if(!c.label||c.label==='DIV'||c.label==='...'||c.label==='checkbox'||c.tag==='INPUT')continue;
    if(results.some(row=>row.sheet===entry.type&&row.option===c.label&&row.status!=='unverified'))continue;
    record(entry.type,c.label,'unverified','Control inventariado; falta una aserción de resultado específica.');
  }
}

async function finalActions(test) {
  for(const [sheet,option] of [['lyrics-menu','Buscar letras en internet'],['metadata-editor','Buscar carátula en internet']])await test(sheet,option,async()=>{
    const originalFetch=window.fetch;const requests=[];
    window.fetch=async(...args)=>{const item={url:String(args[0]),status:0,error:''};requests.push(item);try{const response=await originalFetch(...args);item.status=response.status;return response;}catch(e){item.error=String(e);throw e;}};
    try {
      if(sheet==='lyrics-menu'){
        await open(sheet);await click(sheet,option);
        for(let i=0;i<115 && (!requests.length||usePlayerStore.getState().isFetchingLyrics);i++)await wait(100);
        const request=requests.find(r=>r.url.includes('lrclib.net'));assert(request,'No se realiza petición a LRCLIB');
        if(request.status===404)return 'LRCLIB responde 404 para la pista sintética y la sheet muestra el resultado sin bloquearse';
        if(request.status!==200){const error=Error('Búsqueda intentada; proveedor no verificable: '+(request.error||'HTTP '+request.status));error.unverified=true;throw error;}
        assert(models.track.lyricsLRC,'Respuesta recibida sin letras guardadas');return 'Respuesta real de LRCLIB y letras guardadas';
      }
      await open(sheet);await wait(400);const inputs=[...menu(sheet).querySelectorAll('input')];
      setInput(inputs[3],'Daft Punk');setInput(inputs[4],'Discovery');setInput(inputs[5],'Daft Punk');await wait();await click(sheet,option);
      for(let i=0;i<160 && (!requests.length||!requests[0].status);i++)await wait(100);
      const request=requests.find(r=>r.url.includes('api.deezer.com'));assert(request,'No se realiza petición a Deezer');
      if(request.status!==200){const error=Error('Búsqueda intentada; proveedor no verificable: '+(request.error||'HTTP '+request.status));error.unverified=true;throw error;}
      for(let i=0;i<25&&!menu(sheet)?.querySelector('img');i++)await wait(100);
      assert(menu(sheet)?.querySelector('img'),'Respuesta HTTP 200 pero no aparece carátula');return 'Búsqueda real en Deezer y previsualización de la carátula descargada';
    } finally {window.fetch=originalFetch;}
  },20000);
  const confirm = async expression => {
    const el=buttons().find(e=>expression.test(label(e))&&!e.closest('[data-desktop-menu-id]')&&!e.closest('.window-titlebar'));
    assert(el,'No se muestra confirmación '+expression);el.click();await wait(350);
  };
  for(const tab of ['Inicio','Biblioteca','Buscar','Etiquetas','Actividad'])await test('app-tabs-order','Pantalla de inicio: '+tab,async()=>{await open('app-tabs-order');await click('app-tabs-order',tab);await click('app-tabs-order','Confirmar y Reiniciar');assert(useSettingsStore.getState().initialAppRoute===tab,'No guarda pantalla inicial');});
  await test('lyrics-menu','Traducciones de confirmación',async()=>{await open('lyrics-menu');await click('lyrics-menu','Eliminar letras');assert(!document.body.innerText.includes('actions.warning')&&!document.body.innerText.includes('actions.confirm'),'La confirmación muestra actions.warning y actions.confirm sin traducir');});
  await test('lyrics-menu','Eliminar letras',async()=>{const original=models.track.lyricsLRC;await open('lyrics-menu');await click('lyrics-menu','Eliminar letras');await confirm(/^Confirmar$|^actions\.confirm$/);await until(()=>!models.track.lyricsLRC,'No borra letras');await database.write(()=>models.track.update(t=>{t.lyricsLRC=original;t.lyricsFetchFailed=false;}));return 'Elimina las letras de la pista de prueba y se restauran tras verificarlo';});
  await test('tag-menu','Eliminar Etiqueta',async()=>{const id=await window.mmplayer.invoke('createTag',{name:'Etiqueta desechable',color:'#123456'});const tag=await database.get('tags').find(id);await open('tag-menu',{tag,callbacks:{}});await click('tag-menu','Eliminar Etiqueta');await confirm(/^Eliminar$/);const tags=await database.get('tags').query().fetch();assert(!tags.some(t=>t.id===id),'No elimina la etiqueta de SQLite');});
  for(const sheet of ['track-menu','album-menu','folder-menu','batch-menu'])await test(sheet,sheet==='track-menu'||sheet==='batch-menu'?'Excluir canción':'Excluir del escaneo',async()=>{
    // Disposable SQLite entities with unique paths. The real MP3/FLAC fixtures
    // remain intact, and no user library is attached to this profile.
    let track,album,artist;const path=models.track.fileUrl+'/exclusion-'+sheet;
    await database.write(async()=>{
      artist=await database.get('artists').create(a=>{a.name='Exclusion '+sheet;a.normalizedName=a.name.toLowerCase();});
      album=await database.get('albums').create(a=>{a.title='Exclusion '+sheet;a.normalizedTitle=a.title.toLowerCase();a.artist.id=artist.id;});
      track=await database.get('tracks').create(t=>{t.title='Exclusion fixture';t.normalizedTitle='exclusion fixture';t.fileUrl=path+'/track.mp3';t.duration=10;t.album.id=album.id;t.artist.id=artist.id;});
    });
    await open(sheet,sheet==='track-menu'?{track,callbacks:{}}:sheet==='album-menu'?{album,callbacks:{}}:sheet==='batch-menu'?{tracks:[track]}:{folderPath:path,callbacks:{}});
    await click(sheet,sheet==='track-menu'||sheet==='batch-menu'?'Excluir canción':'Excluir del escaneo');await wait(150);await confirm(/^Excluir$/);
    for(let i=0;i<20;i++){const tracks=await database.get('tracks').query().fetch();if(!tracks.some(t=>t.id===track.id))return 'La exclusión elimina la entidad desechable de SQLite';await wait(100);}
    throw Error('La pista excluida sigue en la biblioteca');
  });
}

async function extraActions(action, mark, test) {
  for(const [index,field] of ['Velocidad','Tono'].entries())await action('speed-pitch',field+' y restablecer',async()=>{
    const sliders=[...menu('speed-pitch').querySelectorAll('[role="slider"]')];assert(sliders.length===2,'No hay dos sliders');
    const slider=sliders[index];slider.scrollIntoView({block:'center'});await wait();const r=slider.getBoundingClientRect();
    const id=String(Date.now());console.log('SHEET_INPUT '+JSON.stringify({id,x:Math.round(r.x+r.width*.8),y:Math.round(r.y+r.height/2)}));
    await until(()=>window.__sheetInputDone===id,'No llega entrada de Electron');
    const key=index===0?'playbackSpeed':'playbackPitch';assert(Math.abs(usePlayerStore.getState()[key]-1)>.01,field+' no cambia con el slider');
    await click('speed-pitch','Restablecer');assert(Math.abs(usePlayerStore.getState()[key]-1)<.01,field+' no se restablece');return 'Entrada de ratón de Electron y estado del motor comprobados';
  });
  await action('speed-pitch','Modo Vinilo / Hi-Fi',async()=>{const el=menu('speed-pitch').querySelector('input');const before=usePlayerStore.getState().isVinylModeEnabled;el.click();await wait();assert(usePlayerStore.getState().isVinylModeEnabled!==before,'Modo vinilo no cambia');el.click();await wait();});
  for(const tab of ['albums','artists','tracks','playlists','folders']) {
    await test('sort-modal','Ordenación y filtros ('+tab+')',async()=>{
      await open('sort-modal',{activeTab:tab});
      const disclosure=buttons(menu('sort-modal')).find(e=>label(e)==='Ordenar por');
      if(disclosure){const before=new Set(buttons(menu('sort-modal')));disclosure.click();await wait();const options=buttons(menu('sort-modal')).filter(e=>!before.has(e)&&label(e));assert(options.length,'No muestra órdenes');options.at(-1).click();await wait();}
      const checkbox=menu('sort-modal').querySelector('input[type="checkbox"]');if(checkbox){checkbox.click();await wait();}
      await click('sort-modal','Aplicar');assert(!menu('sort-modal'),'No aplica/cierra filtros');
      await open('sort-modal',{activeTab:tab});await click('sort-modal','Limpiar filtros');await click('sort-modal','Aplicar');return 'Cambia orden/filtro, aplica y limpia';
    });
    if(tab!=='folders')for(let index=0;index<(tab==='albums'?6:4);index++)await test('sort-modal',`Orden ${index+1} (${tab})`,async()=>{
      await open('sort-modal',{activeTab:tab});const root=menu('sort-modal');const before=new Set(buttons(root));await click('sort-modal','Ordenar por');
      const options=buttons(root).filter(e=>!before.has(e)&&label(e));assert(options[index],'No existe orden '+index);options[index].click();await wait();await click('sort-modal','Aplicar');
      const values=tab==='albums'?['rating_desc','rating_asc','name_asc','name_desc','year_desc','year_asc']:tab==='artists'?['rating_desc','rating_asc','name_asc','name_desc']:tab==='tracks'?['name_asc','name_desc','duration_desc','duration_asc']:['recent_desc','recent_asc','name_asc','name_desc'];
      const key={albums:'albumSort',artists:'artistSort',tracks:'trackSort',playlists:'playlistSort'}[tab];assert(useLibraryStore.getState()[key]===values[index],'Orden no persistido');return key+'='+values[index];
    });
  }
  await action('advanced-tag-search','Excluir etiqueta / neutral / interruptores',async()=>{await click('advanced-tag-search','Sheet audit tag');await click('advanced-tag-search','Sheet audit tag');for(const el of menu('advanced-tag-search').querySelectorAll('input[type="checkbox"]')){el.click();await wait();}await click('advanced-tag-search','Buscar');const f=window.__sheetSearchResult;assert(f.excludes.includes(models.tag.id)&&f.matchAll&&f.noPlaylists,'No entrega filtros completos');});
  await action('metadata-editor','Guardar metadatos individuales',async()=>{
    await until(()=>menu('metadata-editor')?.querySelectorAll('input').length>=8,'No carga campos');await wait(400);
    const values=['Integración de sheets','7','2','Auditoría artista','Auditoría álbum','Auditoría artista álbum','2024','Test'];
    const inputs=[...menu('metadata-editor').querySelectorAll('input')];assert(inputs.length===8,'Número inesperado de campos: '+inputs.length);
    for(let i=0;i<inputs.length;i++){setInput(inputs[i],values[i]);await wait(35);}
    await click('metadata-editor','Guardar');await until(()=>!menu('metadata-editor'),'No termina guardado');
    const lib=await window.mmplayer.invoke('library');const saved=lib.tracks.find(t=>t.id===models.track.id);assert(saved.title===values[0],'Título no persistido');assert(saved.trackNumber===7&&saved.discNumber===2,'Numeración no persistida');return 'Escritura física y actualización de biblioteca comprobadas';
  });
  await test('metadata-editor','Guardar lote MP3/FLAC y autonumeración',async()=>{
    const tracks=specs['batch-menu'].tracks;assert(tracks.length>=2,'Falta fixture FLAC');await open('metadata-editor',{tracks});await wait(400);
    const inputs=[...menu('metadata-editor').querySelectorAll('input')];assert(inputs[0].disabled||inputs[0].readOnly,'Título no está bloqueado en lote');
    const auto=buttons(menu('metadata-editor')).find(e=>/numeración|números|Automát|automát/.test(label(e)));assert(auto,'No aparece autonumeración');auto.click();await wait();
    const genre=inputs.at(-1);setInput(genre,'Integration batch');await wait();await click('metadata-editor','Guardar');await until(()=>!menu('metadata-editor'),'No acaba lote');
    const lib=await window.mmplayer.invoke('library');for(const t of tracks)assert(lib.tracks.find(x=>x.id===t.id)?.genre==='Integration batch','No guarda género de '+t.id);
    assert(lib.tracks.some(t=>t.trackNumber===1)&&lib.tracks.some(t=>t.trackNumber===2),'Autonumeración no aplicada');return 'Escritura real de género y números en MP3 y FLAC';
  });

  // Browser file chooser is driven with deterministic Files. Storage and parsers are real.
  async function selectFile(sheet,option,file) {
    let selected=false;
    const onClick=e=>{if(e.target instanceof HTMLInputElement&&e.target.type==='file')e.preventDefault();};document.addEventListener('click',onClick,true);
    const observer=new MutationObserver(()=>{const input=document.querySelector('input[type="file"]');if(!input||selected)return;selected=true;const data=new DataTransfer();data.items.add(file);input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
    observer.observe(document.body,{subtree:true,childList:true});
    try {await click(sheet,option);await until(()=>selected,'No abre selector de archivo');await wait(650);}finally{observer.disconnect();document.removeEventListener('click',onClick,true);}
  }
  await action('lyrics-menu','Importar archivo .LRC',async()=>{const text='[00:00.00]Letra importada por integración\n[00:01.00]Segunda línea';await selectFile('lyrics-menu','Importar archivo .LRC',new File([text],'audit.lrc',{type:'text/plain'}));assert(models.track.lyricsLRC===text,'No importa/persiste el archivo LRC');return 'Selector DOM, lectura del archivo y persistencia comprobados';});
  await action('album-menu','Personalizar imagen de CD',async()=>{const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7ioAAAAASUVORK5CYII='),c=>c.charCodeAt(0));await selectFile('album-menu','Personalizar imagen de CD',new File([bytes],'audit.png',{type:'image/png'}));assert(models.album.cdArtUrl,'No persiste imagen de CD');});
  await action('lyrics-menu','Compartir letras',async()=>{await click('lyrics-menu','Compartir letras');await until(()=>document.querySelector('[data-testid="mobile-screen-ShareLyrics"]'),'No abre pantalla de compartir letras');return 'Verifica preparación y apertura; no envía a terceros';});
  await action('canvas-manager','Subir nuevo vídeo',async()=>{
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const ctx=canvas.getContext('2d');
    const stream=canvas.captureStream(10);const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});const chunks=[];
    const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));});
    recorder.start();ctx.fillStyle='#a78bfa';ctx.fillRect(0,0,64,64);await wait(350);recorder.stop();const blob=await done;stream.getTracks().forEach(t=>t.stop());
    await selectFile('canvas-manager','Subir nuevo vídeo',new File([blob],'audit.webm',{type:'video/webm'}));
    await until(()=>!!models.track.bgVideo,'No asigna el Canvas');assert(models.track.bgVideo.startsWith('mmplayer-media://'),'Canvas no guardado de forma persistente');
    return 'Vídeo WebM generado en Chromium, copiado a almacenamiento y asignado a la pista';
  });
  await action('track-menu','Eliminar vídeo de fondo (Canvas)',async()=>{assert(models.track.bgVideo,'No hay Canvas de prueba');await click('track-menu',/Eliminar.*Canvas|Quitar.*Canvas/);await until(()=>!models.track.bgVideo,'No elimina la asignación de Canvas');});
  await test('track-menu','Valoración: medias estrellas, completas y borrar',async()=>{
    await open('track-menu');const stars=buttons(menu('track-menu')).filter(e=>label(e)==='DIV');assert(stars.length===10,'No hay diez mitades de estrella');
    stars[0].click();await until(()=>models.track.rating===.5,'No guarda media estrella');stars[7].click();await until(()=>models.track.rating===4,'No guarda cuatro estrellas');
    const clear=buttons(menu('track-menu')).find(e=>!label(e));assert(clear,'No hay control de borrar');clear.click();await until(()=>models.track.rating===null,'No borra valoración');
  });
  for(const which of ['manual','context'])await test('clear-queue','Borrar cola '+which,async()=>{
    const lib=await window.mmplayer.invoke('library');await player.start(lib.tracks,0,false);await usePlayerStore.getState().addToQueueEnd(models.track);await wait(200);
    await open('clear-queue');const before=player.getQueueTracks().length;await click('clear-queue',which==='manual'?/Borrar.*añadida/:/Borrar contexto/);await until(()=>player.getQueueTracks().length<before,'No vacía la cola '+which);return 'Elimina próximas pistas del tipo solicitado';
  });
  for(const tab of ['queue-tab-upcoming','queue-tab-recent'])await test('queue',tab,async()=>{await open('queue');const el=document.querySelector(`[data-testid="${tab}"]`);assert(el,'No hay pestaña');el.click();await wait();assert(document.querySelector('[data-testid="desktop-queue-sheet"]'),'Desaparece cola');});
  await test('queue','Guardar cola completa en playlist',async()=>{await open('queue');document.querySelector('[data-testid="queue-save-playlist"]').click();await wait();document.querySelector('[data-testid="queue-save-all"]').click();await wait();assert(menu('playlist-selector'),'No abre selector con la cola');});
  await test('queue','Gestionar cola y cancelar',async()=>{await open('queue');document.querySelector('[data-testid="queue-manage"]').click();await wait();assert(document.querySelector('[data-testid="queue-manage-options"]'),'No aparece gestión');const el=buttons(document.querySelector('[data-testid="queue-manage-options"]')).find(e=>label(e)==='Cancelar');assert(el,'No hay cancelar');el.click();await wait();assert(!document.querySelector('[data-testid="queue-manage-options"]'),'No se cierra gestión');});
  await open('track-details');
  const copyCount=buttons(menu('track-details')).filter(e=>!label(e)).length;
  for(let i=0;i<copyCount;i++)await test('track-details','Copiar campo '+(i+1),async()=>{
    await open('track-details');const el=buttons(menu('track-details')).filter(e=>!label(e))[i];
    const row=clean(el.parentElement.innerText);el.scrollIntoView({block:'center'});await wait();const r=el.getBoundingClientRect(),clickId=String(Date.now());
    console.log('SHEET_INPUT '+JSON.stringify({id:clickId,x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)}));await until(()=>window.__sheetInputDone===clickId,'No llega entrada de ratón');
    await wait(200);const id=String(Date.now());console.log('SHEET_CLIPBOARD '+id);
    await until(()=>window.__sheetClipboard?.id===id,'No se lee portapapeles');const value=window.__sheetClipboard.value;
    assert(value && row.includes(clean(value)),'No copia el valor del campo');return 'Texto copiado coincide con la propiedad mostrada';
  });
}

window.__runSheetAudit = async () => {
  console.log('SHEET_AUDIT SETUP start');
  const snapshot = await bounded(window.mmplayer.invoke('library'), 'library');
  const track = await bounded(database.get('tracks').find(snapshot.tracks[0].id), 'track');
  const allTracks=await Promise.all(snapshot.tracks.map(t=>database.get('tracks').find(t.id)));
  console.log('SHEET_AUDIT SETUP track');
  const album = await bounded(database.get('albums').find(snapshot.tracks[0].albumId), 'album');
  const artist = await bounded(database.get('artists').find(snapshot.tracks[0].artistId), 'artist');
  const pid = await bounded(window.mmplayer.invoke('createPlaylist', { name: 'Sheet audit playlist' }), 'create playlist');
  const tid = await bounded(window.mmplayer.invoke('createTag', { name: 'Sheet audit tag', color: '#a78bfa' }), 'create tag');
  await bounded(window.mmplayer.invoke('addToPlaylist', { playlistId: pid, trackIds: [track.id] }), 'associate playlist');
  const playlist = await bounded(database.get('playlists').find(pid), 'playlist');
  const tag = await bounded(database.get('tags').find(tid), 'tag');
  await database.write(()=>database.get('track_tags').create(link=>{link.track.id=track.id;link.tag.id=tag.id;}));
  models = { track, album, artist, playlist, tag };
  console.log('SHEET_AUDIT SETUP fixtures');
  await bounded(player.start(snapshot.tracks, 0, false), 'start player');
  console.log('SHEET_AUDIT SETUP player');
  specs = {
    'track-menu': { track, callbacks: {}, metadata: { coverUrl: album.coverUrl, artistName:artist.name, albumId:album.id, artists:[artist] } }, 'album-menu': { album, callbacks: {} }, 'artist-menu': { artist, callbacks: {} },
    'folder-menu': { folderPath: track.fileUrl.substring(0, track.fileUrl.lastIndexOf('/')), callbacks: {} },
    'playlist-menu': { playlist, callbacks: {} }, 'lyrics-menu': { track, callbacks: {} }, 'artists-list': { artists: [artist] },
    'sleep-timer': {}, 'speed-pitch': {}, 'library-tabs-order': {}, 'app-tabs-order': {}, 'home-sections': {},
    'swipe-action': { target: 'left' }, 'sort-modal': { activeTab: 'tracks' }, 'metadata-editor': { tracks: [track] },
    'playlist-selector': { tracksToAssociate: [track], playlistToEdit: null, isCreatingDirectly: false },
    'tag-manager': { targetType: 'track', targetId: track.id, targetTitle: track.title }, 'tag-menu': { tag, callbacks: {} },
    'player-menu': {}, 'batch-menu': { tracks: allTracks }, 'advanced-tag-search': { onSearch: filters => window.__sheetSearchResult = filters },
    'edit-alias': {}, 'clear-queue': {}, 'canvas-manager': { tracks: [track] }, 'track-details': { track },
    'notification-settings': {}, 'queue-destination': { tracks: [track] }, 'queue': {}, 'local-cast': {},
  };
  window.__sheetAuditDriver = { models, specs, open, click, state, buttons, label, setInput, results };
  await test('catalog','ALL: registro completo de sheets',async()=>{
    assert(window.__sheetExpectedTypes?.length,'No hay catalogo de tipos');
    const missing=window.__sheetExpectedTypes.filter(type=>!Object.hasOwn(specs,type));assert(!missing.length,'Faltan fixtures: '+missing.join(', '));
    return window.__sheetExpectedTypes.length+' tipos contrastados con useUIStore, mas tag-form y subniveles de escritorio';
  });
  const inventory = [];
  for (const type of Object.keys(specs)) {
    await test(type, 'Abrir y mostrar contenido', async () => {
      const root = await open(type);
      if (type === 'queue') { assert(document.querySelector('[data-testid="desktop-queue-sheet"]'), 'Cola de escritorio no visible'); return 'Se abre DesktopQueuePanel'; }
      if (type === 'local-cast') { assert(root && clean(root.innerText), 'LocalCast no se renderiza en DesktopSheetHost'); return; }
      assert(root && clean(root.innerText), 'Sheet vacía o no registrada');
      inventory.push({ type, text: clean(root.innerText), controls: buttons(root).map((el,i) => ({ i, label:label(el), tag:el.tagName, role:el.getAttribute('role'), disabled:!!el.disabled || el.getAttribute('aria-disabled') === 'true', type:el.type })) });
      return `${buttons(root).length} controles encontrados`;
    });
  }
  await reset();
  await runActions(inventory);
  await runAllOptions({test,open,click,reset,wait,until,assert,buttons,label,menu,setInput,models,specs});
  await runLyricsRepairs({test,open,click,reset,wait,until,assert,buttons,label,menu,setInput,models,specs});
  await runPlayerAppearance({test,reset,wait,until,assert,models});
  await runFooterFunctions({test,reset,wait,until,assert,models,menu,click});
  await runLyricsLayout({test,reset,wait,until,assert,models});
  await runMissingAndDetails({test,reset,wait,until,assert,models,buttons,label,specs});
  await runSidebarNavigation({test,reset,wait,until,assert});
  await runDiscordPresence({test,reset,wait,until,assert});
  await runContextMenus({test,reset,wait,until,assert,models,menu,buttons,label});
  await runDesktopSettings({test,reset,wait,until,assert,menu,buttons,label});
  await runQueueVirtualization({test,reset,wait,until,assert});
  await test('player','Canvas fits panel and preserves colors',async()=>{
    await reset();await window.mmplayer.invoke('preferences',{playerVisible:true});await player.start((await window.mmplayer.invoke('library')).tracks,0,false);const previous=models.track.bgVideo,showCanvas=useSettingsStore.getState().showCanvas;
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=128;
    const ctx=canvas.getContext('2d');ctx.fillStyle='#00ff00';ctx.fillRect(0,0,64,128);
    ctx.fillStyle='#ff0000';ctx.fillRect(0,0,16,128);ctx.fillStyle='#0000ff';ctx.fillRect(48,0,16,128);
    const stream=canvas.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
    const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));});
    recorder.start();for(let frame=0;frame<8;frame++){ctx.fillStyle='#00ff00';ctx.fillRect(16,0,32,128);await wait(100);}recorder.stop();const url=URL.createObjectURL(await done);stream.getTracks().forEach(t=>t.stop());
    try {
      useSettingsStore.setState({showCanvas:true});await player.pause();usePlayerStore.setState({activeTrack:models.track});await database.write(()=>models.track.update(t=>{t.bgVideo=url;}));
            await until(()=>document.querySelector('.player-panel [data-testid="player-canvas"] video')?.readyState>=2,'Canvas no carga');
      for(const zoomFactor of [.7,1,1.3]) {
        await window.mmplayer.invoke('preferences',{zoomFactor});await wait(400);
        const video=document.querySelector('.player-panel [data-testid="player-canvas"] video'),root=video.parentElement;
        const a=video.getBoundingClientRect(),b=document.querySelector('.player-panel').getBoundingClientRect();
        assert(Math.abs(a.width-b.width)<2&&Math.abs(a.height-b.height)<2,'Vídeo conserva tamaño intrínseco con zoom '+zoomFactor);
        assert(getComputedStyle(video).objectFit==='cover','Canvas deja franjas en el panel');
        const gradient=root.querySelector('[data-testid="player-canvas-controls-gradient"]');assert(gradient,'Falta degradado de controles');const grad=gradient.getBoundingClientRect();assert(grad.top>a.top+a.height*.5&&Math.abs(grad.bottom-a.bottom)<1,'El degradado debe cubrir solo la zona inferior');
        for(let el=video;el&&el!==document.body;el=el.parentElement){const css=getComputedStyle(el);assert(css.filter==='none'&&css.backdropFilter==='none'&&Number(css.opacity)===1,'Filtro o transparencia altera el vídeo');}
        const id=String(Date.now());console.log('SHEET_PIXEL '+JSON.stringify({id,x:a.x+a.width/2,y:a.y+a.height*.35}));
        await until(()=>window.__sheetPixel?.id===id,'No captura color del Canvas');
        const actual=window.__sheetPixel.rgb;
        // Compare with direct playback of the same file, outside PlayerScreen.
        const swatch=document.createElement('video');swatch.src=url;swatch.muted=true;swatch.loop=true;
        Object.assign(swatch.style,{position:'fixed',left:(a.x+a.width/2-10)+'px',top:(a.y+a.height*.35-10)+'px',width:'20px',height:'20px',objectFit:'fill',zIndex:'30000'});document.body.append(swatch);await swatch.play();await until(()=>swatch.readyState>=2,'No reproduce referencia');await wait(100);
        const referenceId=id+'-reference';console.log('SHEET_PIXEL '+JSON.stringify({id:referenceId,x:a.x+a.width/2,y:a.y+a.height*.35}));
        try {await until(()=>window.__sheetPixel?.id===referenceId,'No captura referencia');const referenceRgb=window.__sheetPixel.rgb;assert(actual.every((value,i)=>Math.abs(value-referenceRgb[i])<8),'Color mostrado difiere del fotograma: '+actual+' / '+referenceRgb);}finally{swatch.pause();swatch.remove();}
      }
      const blob=await (await fetch(url)).blob();
      for(let index=0;index<4;index++)await MediaAssetService.saveNewCanvasVideo(URL.createObjectURL(blob),'grid-audit-'+index);
      for(const zoomFactor of [.7,1,1.3]) {
        await window.mmplayer.invoke('preferences',{zoomFactor});await open('canvas-manager');
        await until(()=>document.querySelectorAll('[data-testid="canvas-grid-item"]').length>=4,'No carga galería de Canvas');
        const cards=[...document.querySelectorAll('[data-testid="canvas-grid-item"]')].map(el=>el.getBoundingClientRect());
        assert(Math.abs(cards[0].top-cards[1].top)<1&&Math.abs(cards[1].top-cards[2].top)<1&&cards[3].top>cards[0].bottom,'No hay tres vídeos por fila');
        const panel=menu('canvas-manager').getBoundingClientRect();assert(cards.slice(0,3).every(r=>r.left>=panel.left&&r.right<=panel.right),'Miniaturas desbordan la sheet');
      }
      return 'Canvas llena el panel, conserva color arriba y oscurece controles; galería de tres columnas en tres niveles de zoom';
    } finally {
      await window.mmplayer.invoke('preferences',{zoomFactor:1});await database.write(()=>models.track.update(t=>{t.bgVideo=previous;}));
      useSettingsStore.setState({showCanvas});URL.revokeObjectURL(url);
    }
  },20000);
  await test('layout','Panel boundaries across zoom levels',async()=>{
    await reset();
    try {
      for(const zoomFactor of [.5,.9,1,1.1,1.2,1.3]) {
        await window.mmplayer.invoke('preferences',{zoomFactor});await wait(250);
        const center=document.querySelector('.center'), screen=center.querySelector('.mobile-screen');
        const a=center.getBoundingClientRect(),b=screen.getBoundingClientRect();
        assert(Math.abs(a.left-b.left)<1 && Math.abs(a.right-b.right)<1,'Franjas laterales con zoom '+zoomFactor);
      }
    } finally {await window.mmplayer.invoke('preferences',{zoomFactor:1});}
  });
  await test('tag-manager','Tag form contextual sublevel lifecycle',async()=>{
    await open('tag-manager');await click('tag-manager','Crear nueva etiqueta');
    const root=menu('tag-form');assert(root && menu('tag-manager'),'Falta formulario o menú padre');
    assert(!document.querySelector('[data-desktop-modal-layer]'),'El formulario se abre como modal');
    const r=root.getBoundingClientRect();assert(r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight,'Formulario fuera del viewport');
    setInput(root.querySelector('input'),'Contextual tag integration');await wait();
    await click('tag-form',/^Crear etiqueta$/i);
    await until(()=>!menu('tag-form'),'No cierra formulario al guardar');
    assert(menu('tag-manager'),'Guardar cierra el padre');
    const tags=await database.get('tags').query().fetch();assert(tags.some(t=>t.name==='Contextual tag integration'),'No guarda etiqueta');
    await click('tag-manager','Crear nueva etiqueta');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait();
    assert(!menu('tag-form')&&menu('tag-manager')&&!useTagFormStore.getState().isVisible,'Escape no vuelve al padre');
    await click('tag-manager','Crear nueva etiqueta');
    desktopMenus.clear();await wait();assert(!useTagFormStore.getState().isVisible,'Queda estado huérfano al cerrar menú');
  });
  await test('player','Desktop shared transport and easter egg',async()=>{
    await reset();await window.mmplayer.invoke('preferences',{playerVisible:true});await player.start((await window.mmplayer.invoke('library')).tracks,0,false);await wait(300);
    assert(!document.querySelector('.player-panel [data-testid="player-progress-slider"], .player-panel [data-testid="player-transport-controls"]'),'PlayerScreen duplica slider o transporte');
    assert(document.querySelector('.bottom-player [data-testid="player-progress-slider"]')&&document.querySelector('.bottom-player [data-testid="player-transport-controls"]'),'Faltan los componentes compartidos en el footer');
    assert(document.querySelector('[data-testid="player-lyrics-slot"]')&&document.querySelector('[data-testid="desktop-player-functions"]')&&!document.querySelector('.player-panel [data-testid="player-toggle-lyrics"]'),'Letras en PlayerScreen y funciones solo en el reproductor persistente');
    const track=models.track, original=await window.mmplayer.invoke('readMetadata',{uri:track.fileUrl});
    try {
      const result=await window.mmplayer.invoke('writeMetadata',[{filePath:track.fileUrl,metadata:{album:'you seem pretty sad for a girl so in love',artist:'Olivia Rodrigo'}}]);
      assert(result[0]?.success,'No prepara metadatos del easter egg');
      await until(()=>document.querySelector('.bottom-player [data-testid="player-progress-slider"] img'),'No aparece thumb del easter egg');
      const slider=document.querySelector('.bottom-player [data-testid="player-progress-slider"]');
      assert([...slider.querySelectorAll('*')].some(node=>getComputedStyle(node).backgroundColor==='rgb(247, 94, 145)'),'No aplica color del easter egg');
    } finally {await window.mmplayer.invoke('writeMetadata',[{filePath:track.fileUrl,metadata:original}]);}
    await until(()=>!document.querySelector('.bottom-player [data-testid="player-progress-slider"] img'),'No restaura thumb normal');
    return 'Un único transporte en footer; thumb y color del álbum verificados y restaurados';
  });
  await reset();
  await test('switches','Transparent hit targets keep track and thumb visible',async()=>{
    await reset();const saved=(await window.mmplayer.invoke('state')).preferences;
    const profilePosition=useSettingsStore.getState().homeProfilePosition;
    const verifyInputs=root=>{
      const inputs=[...root.querySelectorAll('input[role="switch"]')];assert(inputs.length,'No hay interruptores');
      for(const input of inputs){const css=getComputedStyle(input);assert(css.backgroundColor==='rgba(0, 0, 0, 0)'&&css.borderTopWidth==='0px'&&css.paddingTop==='0px','El área de clic tapa el interruptor: '+css.backgroundColor+' / '+css.borderTopWidth);assert(css.appearance==='none','Se muestra el checkbox nativo');}
      return inputs;
    };
    try {
      navigationRef.navigate('SettingsAppearance');await until(()=>document.querySelector('[data-testid="mobile-screen-SettingsAppearance"]'),'No abre apariencia');
      const input=verifyInputs(document.querySelector('[data-testid="mobile-screen-SettingsAppearance"]'))[0];
      const previous=input.checked;input.click();await until(()=>input.checked!==previous,'Interruptor de pantalla no responde');input.click();
      for(const zoomFactor of [.7,1,1.3]) {
        await window.mmplayer.invoke('preferences',{zoomFactor});await open('notification-settings');
        const root=menu('notification-settings');verifyInputs(root);
        for(const checked of [false,true]) {
          const input=root.querySelector('input[role="switch"]');if(input.checked!==checked)input.click();
          await wait(250);assert(input.checked===checked,'No cambia interruptor de sheet');
          const thumb=input.previousElementSibling;input.scrollIntoView({block:'center'});await wait(100);
          const rect=thumb.getBoundingClientRect(),expected=getComputedStyle(thumb).backgroundColor.match(/\d+/g).slice(0,3).map(Number);
          if(checked)assert(expected.every(value=>value===255),'El círculo activo debe ser blanco');
          const id='switch-'+zoomFactor+'-'+checked;
          console.log('SHEET_PIXEL '+JSON.stringify({id,x:rect.x+rect.width/2,y:rect.y+rect.height/2}));
          await until(()=>window.__sheetPixel?.id===id,'No captura interruptor');
          assert(window.__sheetPixel.rgb.every((v,i)=>Math.abs(v-expected[i])<12),'La capa de clic oculta el círculo: '+window.__sheetPixel.rgb+' / '+expected);
        }
      }
      return 'Pantalla y sheet: clic funcional, pista y círculo visibles; píxeles reales encendido/apagado al 70%, 100% y 130%';
    } finally {await reset();useSettingsStore.setState({homeProfilePosition:profilePosition});await window.mmplayer.invoke('preferences',{zoomFactor:saved.zoomFactor});}
  },20000);
  await test('sidebar','Pinned shortcuts navigation persistence and live updates',async()=>{
    await reset();
    const saved=(await window.mmplayer.invoke('state')).preferences;
    const oldPins=[models.playlist,models.album,models.artist].map(model=>model.isPinned);
    const pin=(kind,id)=>document.querySelector(`[data-testid="sidebar-pins"] [data-pin-kind="${kind}"][data-pin-id="${CSS.escape(id)}"]`);
    try {
      await window.mmplayer.invoke('preferences',{pinnedShortcuts:[],sidebarWidth:224});
      await database.write(async()=>{for(const model of [models.playlist,models.album,models.artist])await model.update(record=>{record.isPinned=false;});});
      await wait(300);assert(!pin('playlist',models.playlist.id),'Playlist sin fijar visible');
      for(const [kind,model,screen] of [['playlist',models.playlist,'PlaylistDetail'],['album',models.album,'AlbumDetail'],['artist',models.artist,'ArtistDetail']]) {
        await open(kind+'-menu');await click(kind+'-menu',/Fijar/);
        await until(()=>pin(kind,model.id),'No aparece acceso '+kind);
        pin(kind,model.id).click();await until(()=>document.querySelector(`[data-testid="mobile-screen-${screen}"]`),'No navega '+kind);
      }
      for(const [kind,id,screen] of [['tag',models.tag.id,'TagDetail'],['folder',specs['folder-menu'].folderPath,'FolderDetail']]) {
        await open(kind+'-menu');await click(kind+'-menu',/Fijar/);
        await until(()=>pin(kind,id),'No aparece acceso '+kind);
        assert((await window.mmplayer.invoke('state')).preferences.pinnedShortcuts.some(item=>item.kind===kind&&item.id===id),'No persiste '+kind);
        pin(kind,id).click();await until(()=>document.querySelector(`[data-testid="mobile-screen-${screen}"]`),'No navega '+kind);
      }
      const oldName=models.tag.name;
      await database.write(()=>models.tag.update(record=>{record.name='Renamed pin';}));
      await until(()=>pin('tag',models.tag.id)?.title==='Renamed pin','Etiqueta fijada no actualiza nombre');
      await database.write(()=>models.tag.update(record=>{record.name=oldName;}));
      await until(()=>pin('tag',models.tag.id)?.title===oldName,'No restaura nombre');
      const titles=[...document.querySelectorAll('[data-testid="sidebar-pins"] button')].map(el=>el.title);
      assert(titles.every((name,i)=>!i||titles[i-1].localeCompare(name,'es',{sensitivity:'base',numeric:true})<=0),'Orden incorrecto');
      await window.mmplayer.invoke('preferences',{sidebarWidth:64});await wait(200);
      assert(pin('tag',models.tag.id)?.querySelector('svg'),'Falta icono compacto');
      assert(!pin('tag',models.tag.id)?.querySelector('span'),'Modo compacto mantiene texto');
      for(const kind of ['tag','folder']) {await open(kind+'-menu');await click(kind+'-menu',/Desfijar/);await until(()=>!pin(kind,kind==='tag'?models.tag.id:specs['folder-menu'].folderPath),'No desfija '+kind);}
      return 'Cinco tipos de acceso, menús reales, rutas, persistencia, renombrado, orden y modo compacto';
    } finally {
      await reset();await window.mmplayer.invoke('preferences',{pinnedShortcuts:saved.pinnedShortcuts,sidebarWidth:saved.sidebarWidth});
      await database.write(async()=>{let i=0;for(const model of [models.playlist,models.album,models.artist])await model.update(record=>{record.isPinned=oldPins[i++];});});
    }
  },25000);
  await test('collaborators','Snapshot player and Windows media metadata update',async()=>{
    await reset();const collection=database.get('artists'), credits=database.get('track_collaborators');
    let guest,credit;
    try {
      await database.write(async()=>{
        guest=await collection.create(record=>{record.name='Desktop Guest';record.normalizedName='desktop guest';});
        credit=await credits.create(record=>{record.track.id=models.track.id;record.artist.id=guest.id;});
      });
      const snapshot=await window.mmplayer.invoke('library');const current=snapshot.tracks.find(track=>track.id===models.track.id);
      assert(current.artist.includes('Desktop Guest'),'Snapshot sin colaborador');
      await player.start([current],0,false);
      await until(()=>player.getSnapshot().track.artist.includes('Desktop Guest'),'Reproductor sin colaborador');
      await until(()=>document.querySelector('.bottom-player')?.textContent.includes('Desktop Guest'),'Barra inferior sin colaborador');
      await until(()=>navigator.mediaSession.metadata?.artist.includes('Desktop Guest'),'Media Session sin colaborador');
      navigationRef.navigate('Player');await wait(500);
      assert(document.querySelector('[data-testid="mobile-screen-Player"]')?.textContent.includes('Desktop Guest'),'PlayerScreen sin colaborador');
      await database.write(()=>credit.destroyPermanently());credit=null;
      await until(()=>!player.getSnapshot().track.artist.includes('Desktop Guest'),'No actualiza colaborador eliminado');
      await until(()=>!navigator.mediaSession.metadata?.artist.includes('Desktop Guest'),'SMTC mantiene colaborador obsoleto');
      const callbacks=[];
      await ScannerService.repairCollaborators((current,total,phase)=>callbacks.push({current,total,phase}));
      assert(callbacks.length===2 && callbacks[1].current>0,'Reparación no procesa archivos reales');
      return 'SQLite real → snapshot → barra inferior, PlayerScreen y Media Session de Windows; actualización sin cambiar canción';
    } finally {if(credit)await database.write(()=>credit.destroyPermanently());if(guest)await database.write(()=>guest.destroyPermanently());await reset();}
  },20000);
  await test('notifications','Automatic summaries preferences unread state and navigation',async()=>{
    await reset();await player.pause();const RealDate=window.Date,originalPrefs=useSettingsStore.getState().notificationPreferences;
    let currentTime=new RealDate(2026,10,2,12).getTime();const history=[];
    const oldIds=new Set((await NotificationService.getNotifications()).map(row=>row.id));
    window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[currentTime]));}static now(){return currentTime;}};
    const ranges=[getPreviousWeekRange(),getPreviousMonthRange(),getPreviousYearRange()];
    try {
      useSettingsStore.setState({notificationPreferences:{...originalPrefs,summary_weekly:false,summary_monthly:true,summary_yearly:true,app_update:false}});
      for(const range of ranges)history.push(await database.write(()=>database.get('playback_history').create(row=>{row.itemId=models.track.id;row.itemType='track';row.playContext='notification-test';row.durationPlayed=80;row.playedAt=new Date(range.from.getTime()+24*60*60*1000);})));
      for(let i=0;i<10;i++)window.dispatchEvent(new Event('focus'));
      await wait(400);
      let rows=await NotificationService.getNotifications();assert(rows.some(row=>row.id===ranges[1].periodKey)&&rows.some(row=>row.id===ranges[2].periodKey),'No genera resúmenes mensual/anual al enfocar');assert(!rows.some(row=>row.id===ranges[0].periodKey),'Ignora preferencia semanal desactivada');
      assert(useNotificationStore.getState().unreadCount>=2,'No actualiza contador sin leer');
      await open('notification-settings');const switches=buttons(menu('notification-settings')).filter(el=>el.getAttribute('role')==='switch');assert(switches.length>=6,'No hay preferencias');switches[3].click();await click('notification-settings',/^Guardar/);
      await wait(350);rows=await NotificationService.getNotifications();assert(rows.some(row=>row.id===ranges[0].periodKey),'Guardar ajustes no activa resumen semanal');
      for(let i=0;i<10;i++)window.dispatchEvent(new Event('focus'));await wait(300);
      rows=await NotificationService.getNotifications();assert(ranges.every(range=>rows.filter(row=>row.id===range.periodKey).length===1),'Crea resúmenes duplicados');
      const weekly=rows.find(row=>row.id===ranges[0].periodKey),payload=JSON.parse(weekly.actionPayload);assert(payload.period==='week'&&payload.from===ranges[0].from.toISOString(),'Rango del resumen incorrecto');
      navigationRef.navigate('Notifications');await until(()=>document.querySelector('[data-testid="mobile-screen-Notifications"]'),'No abre notificaciones');await wait(250);
      const card=buttons(document.querySelector('[data-testid="mobile-screen-Notifications"]')).find(el=>el.getAttribute('aria-label')===weekly.title);assert(card,'No muestra resumen semanal');card.click();
      await until(()=>document.querySelector('[data-testid="mobile-screen-ShareStats"]'),'Resumen no abre estadísticas');assert((await database.get('notifications').find(weekly.id)).isRead,'No marca resumen leído');
      await NotificationService.markAllAsRead();await until(()=>useNotificationStore.getState().unreadCount===0,'No baja contador a cero');
      currentTime=new RealDate(2027,0,1,12).getTime();window.dispatchEvent(new Event('focus'));await wait(350);
      const year=getPreviousYearRange();rows=await NotificationService.getNotifications();assert(rows.some(row=>row.id===year.periodKey),'No genera resumen del nuevo año');assert(!rows.some(row=>row.id===getPreviousMonthRange().periodKey),'Genera resumen de mes sin escuchas');
      return 'Ciclo real de PC con reloj aislado: resúmenes según historial, preferencias desde sheet, sin duplicados, contador reactivo, lectura y navegación al resumen y cambio de año';
    } finally {
      window.Date=RealDate;
      await database.write(async()=>{for(const row of history)await row.destroyPermanently();const rows=await database.get('notifications').query().fetch();for(const row of rows)if(!oldIds.has(row.id))await row.destroyPermanently();});
      useSettingsStore.setState({notificationPreferences:originalPrefs});
    }
  },20000);
  await test('sharing','Song lyrics and activity cards export complete PNG files',async()=>{
    await reset();await player.pause();
    const cover=FileSystem.documentDirectory+'media_assets/album_covers/share-cover.png';const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const context=canvas.getContext('2d');context.fillStyle='#ff4080';context.fillRect(0,0,256,256);context.fillStyle='#20c0ff';context.fillRect(64,64,128,128);await FileSystem.writeAsStringAsync(cover,canvas.toDataURL().split(',')[1],{encoding:'base64'});
    const cards=[
      ['ShareSong',{title:'Canción de prueba 🎵',artist:'Artista Ñ',album:'Álbum',coverUrl:cover,fileUrl:models.track.fileUrl,duration:185},/Compartir imagen/],
      ['ShareLyrics',{title:'Canción con letras',artist:'Artista Ñ',album:'Álbum',coverUrl:cover,lyricsLines:[{time:1,text:'Primera línea con acentos'},{time:2,text:'Segunda línea de prueba'}],initialIndex:0},/Compartir imagen/],
      ['ShareStats',{formattedPeriodText:'Octubre de 2026',metric:'duration',totalHours:12.5,totalPlays:123,topArtists:[{id:'a',name:'Artista Ñ',imageUrl:cover,duration:30000,plays:50}],topSongs:[{id:'t',title:'Canción de prueba',artistName:'Artista Ñ',coverUrl:cover,duration:20000,plays:30}]},/^Compartir$/],
    ];
    for(const [cardIndex,[screen,params,shareLabel]] of cards.entries()){
      await window.mmplayer.invoke('preferences',{zoomFactor:[.7,1,1.3][cardIndex]});
      navigationRef.navigate(screen,params);await until(()=>document.querySelector('[data-testid="mobile-screen-'+screen+'"]'),'No abre '+screen);await wait(300);
      if(screen==='ShareLyrics'){const next=buttons(document.querySelector('.center')).find(el=>/Continuar|Vista previa|Ver tarjeta/.test(label(el)));assert(next,'No permite previsualizar letras');next.click();await wait();}
      const card=document.querySelector('[data-testid="desktop-share-card"]');assert(card,'No hay tarjeta '+screen);
      window.__sheetLastSavedFile=null;const button=buttons(document.querySelector('.center')).find(el=>shareLabel.test(label(el)));assert(button,'No hay botón de compartir '+screen);button.click();
      await bounded((async()=>{for(let i=0;i<150;i++){if(window.__sheetLastSavedFile)return;await wait(100);}throw Error('No guarda PNG '+screen);})(),'Captura '+screen,16000);await wait(250);
      const path=window.__sheetLastSavedFile;assert((await FileSystem.getInfoAsync(path)).exists,'Archivo PNG ausente');const id=screen;console.log('SHEET_IMAGE '+JSON.stringify({id,path}));await until(()=>window.__sheetImage?.id===id,'No lee PNG');
      const image=window.__sheetImage;assert(image.width===1440&&image.height===2560,'Resolución incorrecta '+screen+': '+image.width+'x'+image.height);assert(image.colors>100&&image.bright>50&&image.bytes>10000&&image.white<5000&&image.bottomBright>10,'Imagen vacía o sin texto '+screen+': '+JSON.stringify(image));
    }
    await window.mmplayer.invoke('preferences',{zoomFactor:1});
    navigationRef.navigate('ShareSong',{title:'Sin portada',artist:'Prueba',coverUrl:null});await wait(300);
    const fallback=await captureRef(document.querySelector('[data-testid="desktop-share-card"]'),{format:'jpg',width:360,height:640,result:'data-uri'});assert(fallback.startsWith('data:image/jpeg;base64,'),'No soporta captura sin portada e icono/JPEG');
    window.__sheetLastSavedFile=null;window.__sheetSaveCancelled=false;window.__sheetCancelNextSave=true;
    buttons(document.querySelector('.center')).find(el=>/Compartir imagen/.test(label(el))).click();
    await bounded((async()=>{for(let i=0;i<150;i++){if(window.__sheetSaveCancelled)return;await wait(100);}throw Error('No permite cancelar');})(),'Cancelar PNG',16000);await wait(150);
    assert(!window.__sheetLastSavedFile,'Cancelar guarda un archivo');
    let rejected=false;try{await captureRef({current:null});}catch{rejected=true;}assert(rejected,'Captura una tarjeta desmontada');
    return 'Tres pantallas reales exportan PNG 1440×2560 en distintos zooms; portada, texto y marca inferior completos. También captura JPEG sin portada con icono';
  },45000);
  await test('lyrics','Physical LRC roundtrip and automatic queue prefetch',async()=>{
    await reset();await player.pause();const track=models.track,original=track.lyricsLRC,failed=track.lyricsFetchFailed,originalFetch=window.fetch;
    const imported='[ar:Prueba ñ]\r\n[00:01.25]Canción áéí 🎵\r\n[00:02.00]Segunda línea';
    const probes=[],requests=[];
    try {
      const prevent=e=>{if(e.target instanceof HTMLInputElement&&e.target.type==='file')e.preventDefault();};document.addEventListener('click',prevent,true);
      let selected=false;const observer=new MutationObserver(()=>{const input=document.querySelector('input[type="file"]');if(!input||selected)return;selected=true;const files=new DataTransfer();files.items.add(new File(['\uFEFF'+imported],'prueba.lrc',{type:'text/plain'}));input.files=files.files;input.dispatchEvent(new Event('change',{bubbles:true}));});observer.observe(document.body,{childList:true,subtree:true});
      try {await open('lyrics-menu');await click('lyrics-menu','Importar archivo .LRC');await until(()=>track.lyricsLRC===imported,'No importa LRC UTF-8/BOM y saltos de línea');}finally{observer.disconnect();document.removeEventListener('click',prevent,true);}
      assert(!track.lyricsFetchFailed,'La importación no permite búsquedas futuras');
      await reset();await open('lyrics-menu');await click('lyrics-menu','Exportar archivo .LRC');
      await until(()=>window.__sheetLastSavedFile,'No abre guardado nativo');
      await wait(250);
      const saved=window.__sheetLastSavedFile;assert(saved.endsWith('.lrc'),'Extensión incorrecta');
      assert(await FileSystem.readAsStringAsync(saved)===imported,'El LRC físico exportado cambia texto o tiempos');
      window.__sheetCancelNextSave=true;assert(await LyricsService.exportLyrics(track)===false,'Cancelar se considera exportado');
      assert(await FileSystem.readAsStringAsync(saved)===imported,'Cancelar modifica el archivo');
      window.fetch=async(input,init)=>{
        const url=new URL(typeof input==='string'?input:input.url);
        if(url.hostname==='lrclib.net'&&url.searchParams.get('track_name')?.startsWith('Queue lyrics probe ')) {
          const title=url.searchParams.get('track_name');requests.push(title);return new Response(JSON.stringify({syncedLyrics:'[00:01]'+title}),{status:200,headers:{'Content-Type':'application/json'}});
        }
        return originalFetch.call(window,input,init);
      };
      for(let i=0;i<4;i++)probes.push(await database.write(()=>database.get('tracks').create(row=>{row.title='Queue lyrics probe '+i;row.normalizedTitle=row.title.toLowerCase();row.fileUrl=track.fileUrl;row.duration=track.duration;row.artist.id=models.artist.id;row.album.id=models.album.id;row.lyricsFetchFailed=false;})));
      await usePlayerStore.getState().loadQueue([track,...probes],0,'lyrics-integration',undefined,false);
      await until(()=>probes[0].lyricsLRC&&probes[1].lyricsLRC,'No precarga dos siguientes al cargar cola');
      assert(!probes[2].lyricsLRC&&!probes[3].lyricsLRC,'Descarga más de tres canciones');assert(requests.length===2,'Solicitudes duplicadas en primera precarga');
      await player.skipTo(1);await player.pause();await until(()=>probes[2].lyricsLRC,'No avanza la precarga al cambiar canción');
      assert(requests.length===3&&!probes[3].lyricsLRC,'No respeta el alcance al avanzar');
      await player.switchQueue(1);await player.pause();await player.switchQueue(0);await wait(350);assert(requests.length===3,'Repite descargas ya almacenadas al cambiar cola');
      return 'Importación desde sheet y LRC físico UTF-8 con BOM, exportación nativa sin alterar tiempos, cancelación, precarga automática y reutilización de caché al avanzar/cambiar cola';
    } finally {
      await usePlayerStore.getState().clearPlayer();window.fetch=originalFetch;
      await database.write(async()=>{for(const row of probes)await row.destroyPermanently();await track.update(row=>{row.lyricsLRC=original;row.lyricsFetchFailed=failed;});});
    }
  },20000);
  await test('storage','Real disk, category sizes, file filters and existence',async()=>{
    await reset();await player.pause();
    const before=await StorageService.getStorageBreakdown(),disk=await getStorageStats();
    assert(disk.totalBytes>0&&disk.freeBytes>0&&disk.usedBytes===disk.totalBytes-disk.freeBytes,'Estadísticas inválidas');
    assert(before.deviceTotalBytes===disk.totalBytes,'Pantalla no usa capacidad real');
    const categories=[['artist_images','artistImagesBytes',211],['playlist_covers','playlistCoversBytes',307],['cd_covers','cdCoversBytes',401],['album_covers','albumCoversBytes',503],['canvas_videos','canvasVideosBytes',601],['canvas_thumbnails','canvasVideosBytes',101]];
    for(const [folder,_key,size] of categories)await FileSystem.writeAsStringAsync(FileSystem.documentDirectory+'media_assets/'+folder+'/storage-test/nested/probe.bin','x'.repeat(size));
    const cache=FileSystem.cacheDirectory+'storage-test/probe.bin';await FileSystem.writeAsStringAsync(cache,'x'.repeat(709));
    const after=await StorageService.getStorageBreakdown();
    for(const [key,expected] of [['artistImagesBytes',211],['playlistCoversBytes',307],['cdCoversBytes',401],['albumCoversBytes',503],['canvasVideosBytes',702],['cacheBytes',709]])assert(after[key]-before[key]===expected,'Desglose incorrecto '+key+': '+(after[key]-before[key]));
    const library=await window.mmplayer.invoke('library');const sizes=await readLibraryFileSizes(library.tracks);
    let expectedAudio=0;for(const track of library.tracks){const info=await FileSystem.getInfoAsync(track.fileUrl);assert(sizes.get(track.id)===info.size&&info.size>0,'Filtro no lee bytes de '+track.id);expectedAudio+=info.size;}
    assert(after.audioFilesBytes===expectedAudio,'Tamaño total de música incorrecto');
    const probe=await resolveAudioUriInfo(library.tracks[0].fileUrl);assert(probe.size===sizes.get(library.tracks[0].id),'Resolución de audio no incluye tamaño');
    const index={...emptyLibraryFilterIndex(),sizes},mb=expectedAudio/(1024*1024);
    assert(matchesFolderFilters(library.tracks,{...EMPTY_SECTION_FILTERS,minSize:mb-.000001,maxSize:mb+.000001},index),'Filtro rechaza carpeta dentro del rango');
    assert(!matchesFolderFilters(library.tracks,{...EMPTY_SECTION_FILTERS,maxSize:mb/2},index),'Filtro acepta carpeta demasiado grande');
    assert(!matchesFolderFilters(library.tracks,{...EMPTY_SECTION_FILTERS,minSize:mb*2},index),'Filtro acepta carpeta demasiado pequeña');
    const uris=[library.tracks[0].fileUrl,models.track.fileUrl,cache,FileSystem.cacheDirectory+'missing.bin',FileSystem.cacheDirectory,'mmplayer-media://track/missing','mmplayer-media://asset/%zz'];
    assert(JSON.stringify(await checkFilesExistOnDisk(uris))===JSON.stringify([true,true,true,false,false,false,false]),'Comprobación de disco devuelve valores falsos');
    const browserSentinel='mmplayer-media://asset/Cache/storage-sentinel.bin';await FileSystem.writeAsStringAsync(browserSentinel,'keep-browser-cache');
    const cachedTrack={...library.tracks[0],id:'cache-size-probe',fileUrl:cache,lastModified:1};assert((await readLibraryFileSizes([cachedTrack])).get(cachedTrack.id)===709,'No lee tamaño antes de borrar');
    await StorageService.clearCache();assert((await checkFilesExistOnDisk([cache]))[0]===false,'Archivo eliminado sigue existiendo');
    const cleared=await StorageService.getStorageBreakdown();assert(cleared.cacheBytes===0,'No actualiza bytes tras limpiar caché');assert((await FileSystem.getInfoAsync(browserSentinel)).exists,'La limpieza afecta la caché de Electron');await FileSystem.deleteAsync(browserSentinel,{idempotent:true});
    await window.mmplayer.invoke('scan');await wait(150);assert((await readLibraryFileSizes([cachedTrack])).get(cachedTrack.id)===null,'Conserva tamaño antiguo tras escaneo');
    const settings=[...document.querySelectorAll('.sidebar nav button')].find(el=>/Configuración|Settings/.test(el.innerText));settings.click();await wait();
    const storage=buttons(document.querySelector('.center')).find(el=>/Almacenamiento|Storage/.test(label(el)));assert(storage,'No hay acceso a almacenamiento');storage.click();
    await until(()=>document.querySelector('[data-testid="mobile-screen-SettingsStorage"]')?.innerText.includes('Unidad de MMPlayer'),'La pantalla no muestra el disco de PC');
    assert(!document.querySelector('[data-testid="mobile-screen-SettingsStorage"]').innerText.includes('Almacenamiento del móvil'),'Etiqueta de móvil en PC');
    for(const [folder] of categories)await FileSystem.deleteAsync(FileSystem.documentDirectory+'media_assets/'+folder+'/storage-test/',{idempotent:true});
    return 'Capacidad real, desglose exacto por bytes, filtros mínimo/máximo, rutas de audio virtuales y físicas, archivos borrados y pantalla de almacenamiento';
  },20000);
  await test('backup','JSON and ZIP export, restore and music ZIP import',async()=>{
    await reset();await player.pause();
    const originalRestart=RNRestart.restart,previousCanvas=useSettingsStore.getState().showCanvas;RNRestart.restart=()=>{};useSettingsStore.setState({showCanvas:false});
    const store=useBackupStore.getState();
    try {
      await BackupService.exportDatabase('json');assert(useBackupStore.getState().mode==='success',useBackupStore.getState().progressMessage);
      const json=await FileSystem.readAsStringAsync(FileSystem.cacheDirectory+'backup_music_app.json');const exported=validateBackupData(JSON.parse(json));assert(exported.tracks.length>=2,'No exporta canciones');
      assert((await FileSystem.getInfoAsync(window.__sheetSaveDirectory+'/backup_music_app.json')).exists,'No guarda archivo JSON en destino nativo');store.close();
      const media=FileSystem.documentDirectory+'media_assets/album_covers/backup-probe.png';await FileSystem.writeAsStringAsync(media,'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7ioAAAAASUVORK5CYII=',{encoding:'base64'});await database.write(()=>models.album.update(t=>{t.coverUrl=media;}));
      await BackupService.exportDatabase('zip');assert(useBackupStore.getState().mode==='success',useBackupStore.getState().progressMessage);store.close();
      const archive=await openBackupArchive(FileSystem.cacheDirectory+'backup_music_app.zip',FileSystem.cacheDirectory+'integration-restore/');assert(archive.manifest.assets.some(asset=>asset.source===media),'ZIP omite medios de PC');
      const staged=await stageArchiveAssets(archive,'integration');assert(staged.paths.length,'No restaura medios');assert(staged.data.albums.some(album=>String(album.cover_url).includes('backup_')),'No reasigna URI de medios');
      const input=JSON.parse(json);input.tracks.find(row=>row.id===models.track.id).is_favorite=!models.track.isFavorite;
      const importPromise=BackupService.importDatabase('json',remapDesktopBackup);
      await until(()=>document.querySelector('input[type="file"]'),'No abre selector de copia');const fileInput=document.querySelector('input[type="file"]'),files=new DataTransfer();files.items.add(new File([JSON.stringify(input)],'backup.json',{type:'application/json'}));fileInput.files=files.files;fileInput.dispatchEvent(new Event('change',{bubbles:true}));
      await until(()=>buttons().some(el=>/Reemplazar/.test(label(el))),'No permite elegir restauración');buttons().find(el=>/Reemplazar/.test(label(el))).click();
      await importPromise;assert(useBackupStore.getState().mode==='success',useBackupStore.getState().progressMessage);
      const restored=await database.get('tracks').find(models.track.id);assert(restored.isFavorite===input.tracks.find(row=>row.id===models.track.id).is_favorite,'No restaura favoritos');store.close();await wait(1100);
      const zipBytes=Uint8Array.from(atob(await FileSystem.readAsStringAsync(FileSystem.cacheDirectory+'backup_music_app.zip',{encoding:'base64'})),c=>c.charCodeAt(0));
      const mergePromise=BackupService.importDatabase('zip',remapDesktopBackup);
      await until(()=>document.querySelector('input[type="file"]'),'No abre selector ZIP');const zipInput=document.querySelector('input[type="file"]'),zipFiles=new DataTransfer();zipFiles.items.add(new File([zipBytes],'backup.zip',{type:'application/zip'}));zipInput.files=zipFiles.files;zipInput.dispatchEvent(new Event('change',{bubbles:true}));
      await until(()=>buttons().some(el=>/Fusionar|Combinar datos/.test(label(el))),'No ofrece fusión ZIP');buttons().find(el=>/Fusionar|Combinar datos/.test(label(el))).click();
      await until(()=>buttons().some(el=>/Mantener.*actual|Conservar.*actual/i.test(label(el))),'No permite resolver conflictos');buttons().find(el=>/Mantener.*actual|Conservar.*actual/i.test(label(el))).click();
      await mergePromise;assert(useBackupStore.getState().mode==='success',useBackupStore.getState().progressMessage);store.close();await wait(1100);
      const root=FileSystem.cacheDirectory+'music-zip-probe/';await FileSystem.makeDirectoryAsync(root,{intermediates:true});await FileSystem.copyAsync({from:restored.fileUrl,to:root+'song.mp3'});
      const zip=FileSystem.cacheDirectory+'music-zip-probe.zip';await window.mmplayer.invoke('fileSystem',{op:'archive',action:'zip',sources:[root],target:zip});
      const result=await window.mmplayer.invoke('importMusicZip',{uri:zip});assert(result.imported===1,'No importa audio del ZIP');assert((await window.mmplayer.invoke('library')).tracks.length>exported.tracks.length,'No escanea música extraída');
      return 'Exportación nativa JSON/ZIP, medios restaurados, reemplazo y fusión con conflictos en SQLite e importación y escaneo de ZIP musical';
    } finally {await wait(1100);RNRestart.restart=originalRestart;useSettingsStore.setState({showCanvas:previousCanvas});store.close();}
  },30000);
  const byCase=new Map();for(const row of results){const key=row.sheet+':'+row.option,previous=byCase.get(key);if(!previous||({fail:3,pass:2,unverified:1}[row.status]>={fail:3,pass:2,unverified:1}[previous.status]))byCase.set(key,row);}
  const finalResults=[...byCase.values()];
  return { scope: 'Electron real con perfil y archivos aislados. Abrir un selector o una confirmación solo verifica ese paso, no la operación final. Los selectores de archivos se alimentan mediante File/DataTransfer de Chromium; parsers, motor, SQLite y escritura de metadatos son reales.', catalog:window.__sheetExpectedTypes, inventory, interactions, results:finalResults, errors, summary: { pass:finalResults.filter(r=>r.status==='pass').length, fail:finalResults.filter(r=>r.status==='fail').length, unverified:finalResults.filter(r=>r.status==='unverified').length } };
};

