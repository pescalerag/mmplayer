// @ts-nocheck -- Executed only by the isolated Electron integration driver.
import i18n from '../../../../src/constants/i18n';
import { Q } from '@nozbe/watermelondb';
import { database } from '../../src/renderer/ports/database';
import { player } from '../../src/renderer/player';
import { usePlayerStore } from '../../src/renderer/ports/playerStore';
import { useSettingsStore } from '../../../../src/store/useSettingsStore';
import { useLibraryStore } from '../../../../src/store/useLibraryStore';
import { useColorPickerModalStore } from '../../../../src/store/useColorPickerModalStore';
import { useQueueRenameModalStore } from '../../../../src/store/useQueueRenameModalStore';
import { useCustomDateModalStore } from '../../../../src/store/useCustomDateModalStore';
import { useTagFormStore } from '../../../../src/store/useTagFormStore';
import { desktopMenus } from '../../src/renderer/desktopMenus';
import { MediaAssetService } from '../../../../src/services/MediaAssetService';
import * as FileSystem from '../../src/renderer/ports/fileSystem';
import * as ui from '../../../../src/store/useUIStore';

export async function runAllOptions(h) {
  const {open,click,reset,wait,until,assert,buttons,label,menu,setInput,models,specs}=h;
  const test=(sheet,option,run,timeout)=>h.test(sheet,option,async()=>{try{return await run();}finally{useQueueRenameModalStore.getState().close();useCustomDateModalStore.getState().close();useColorPickerModalStore.getState().close();}},timeout);
  const modal=()=>document.querySelector('[data-desktop-modal-layer]');
  const activate=async(el)=>{assert(el,'No se encuentra control');el.scrollIntoView({block:'center',inline:'center'});el.click();await wait(90);};
  const choose=async(root,expression)=>{const el=buttons(root).filter(el=>expression.test(label(el))).at(-1);await activate(el);return el;};
  const alertButton=async(expression)=>{const el=buttons().filter(el=>!el.closest('[data-desktop-menu-id]')&&!el.closest('.window-titlebar')&&expression.test(label(el))).at(-1);await activate(el);};
  const seedQueue=async()=>{await reset();const lib=await window.mmplayer.invoke('library');await player.start(lib.tracks,0,false);await usePlayerStore.getState().addToQueueEnd(models.track);await wait(150);};
  const interact=async(el,hold=0)=>{
    el.scrollIntoView({block:'center',inline:'center'});await wait(80);const r=el.getBoundingClientRect(),id='all-'+Date.now();
    console.log('SHEET_INPUT '+JSON.stringify({id,x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),hold}));
    await until(()=>window.__sheetInputDone===id,'No llega entrada real de raton');await wait(100);
  };
  const selectFile=async(sheet,option,file)=>{
    let selected=false;const prevent=e=>{if(e.target instanceof HTMLInputElement&&e.target.type==='file')e.preventDefault();};document.addEventListener('click',prevent,true);
    const observer=new MutationObserver(()=>{const input=document.querySelector('input[type="file"]');if(!input||selected)return;selected=true;const data=new DataTransfer();data.items.add(file);input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));});
    observer.observe(document.body,{subtree:true,childList:true});
    try {if(option instanceof Element)await activate(option);else await click(sheet,option);await until(()=>selected,'No abre selector');await wait(400);}finally{observer.disconnect();document.removeEventListener('click',prevent,true);}
  };
  for(const kind of ['tag','folder','playlist','album','artist'])await test(kind+'-menu','ALL: fijar y desfijar desde el mismo menu',async()=>{
    const model=models[kind];const saved=kind==='tag'||kind==='folder'?(await window.mmplayer.invoke('state')).preferences.pinnedShortcuts:model.isPinned;
    try {for(let i=0;i<2;i++){await open(kind+'-menu');const before=kind==='tag'||kind==='folder'?JSON.stringify((await window.mmplayer.invoke('state')).preferences.pinnedShortcuts):model.isPinned;
      await click(kind+'-menu',/^(Fijar|Desfijar)/);await wait(100);
      const after=kind==='tag'||kind==='folder'?JSON.stringify((await window.mmplayer.invoke('state')).preferences.pinnedShortcuts):model.isPinned;assert(before!==after,'No cambia fijado');}
    }finally{if(kind==='tag'||kind==='folder')await window.mmplayer.invoke('preferences',{pinnedShortcuts:saved});else await database.write(()=>model.update(record=>{record.isPinned=saved;}));}
  });
  for(let palette=0;palette<6;palette++)await test('tag-form','ALL: crear y editar color '+(palette+1),async()=>{
    await open('tag-manager');await click('tag-manager','Crear nueva etiqueta');await until(()=>menu('tag-form'),'No abre subnivel de etiqueta');
    await wait(200);const root=menu('tag-form'),name='ALL tag '+palette;
    const input=root.querySelector('input');setInput(input,name);await wait(80);
    const colors=buttons(root).filter(el=>el.getAttribute('role')==='button'&&!label(el));
    // Palette controls may contain icon glyphs, which are intentionally unnamed.
    const swatches=buttons(root).filter(el=>getComputedStyle(el).width==='32px'&&getComputedStyle(el).height==='32px');
    assert(swatches.length>=6,'No encuentra seis opciones de color');const rgb=getComputedStyle(swatches[palette]).backgroundColor.match(/\d+/g).slice(0,3);let expectedColor='#'+rgb.map(value=>Number(value).toString(16).padStart(2,'0')).join('');await activate(swatches[palette]);
    if(palette===5){await until(()=>root.querySelector('input[type="color"]')||buttons(root).some(el=>/Confirmar color/.test(label(el))),'No abre color personalizado');
      await choose(root,/Select color: #2196F3/i);expectedColor='#2196f3';
      await choose(root,/Confirmar color/);
    }
    await click('tag-form',/Crear etiqueta/i);await until(()=>!menu('tag-form'),'No crea etiqueta');
    const tags=await database.get('tags').query().fetch(),created=tags.find(tag=>tag.name===name);assert(created,'No guarda etiqueta');assert([expectedColor,expectedColor+'ff'].includes(created.color.toLowerCase()),'No guarda el color elegido: '+created.color+' esperado '+expectedColor);
    await open('tag-menu',{tag:created});await click('tag-menu',/Editar etiqueta/);await until(()=>menu('tag-form'),'No abre edicion');
    setInput(menu('tag-form').querySelector('input'),name+' edit');await wait(70);await click('tag-form',/Guardar cambios/i);
    await until(()=>created.name===name+' edit','No guarda edicion');await database.write(()=>created.destroyPermanently());
    return 'Paleta pulsada, alta y edicion persistidas en SQLite';
  });
  await test('tag-form','ALL: nombre vacio duplicado y cancelar subnivel',async()=>{
    await open('tag-manager');await click('tag-manager','Crear nueva etiqueta');await wait(200);const root=menu('tag-form');
    const save=buttons(root).filter(el=>/Crear etiqueta/i.test(label(el))).at(-1);assert(save&&(save.disabled||save.getAttribute('aria-disabled')==='true'),'Permite nombre vacio');
    setInput(root.querySelector('input'),models.tag.name);await wait(80);await click('tag-form',/Crear etiqueta/i);assert(menu('tag-form'),'Acepta etiqueta duplicada');
    await click('tag-form','Cancelar');assert(!menu('tag-form')&&menu('tag-manager'),'No regresa al padre');
  });
  for(const mode of ['cancel','save'])await test('color-picker','ALL: color personalizado '+mode,async()=>{
    await open('player-menu');await click('player-menu','Color personalizado');await until(()=>modal(),'No abre selector');
    const before=useSettingsStore.getState().playerVisualizerCustomColor;
    const swatches=buttons(modal()).filter(el=>/^Select color:/.test(label(el)));assert(swatches.length,'No hay muestras de color');for(const swatch of swatches)await activate(swatch);await choose(modal(),/Select color: #2196F3/i);
    await choose(modal(),mode==='save'?/Confirmar color/:/^Cancelar$/);
    assert(!useColorPickerModalStore.getState().request,'No cierra selector');
    assert(useSettingsStore.getState().playerVisualizerCustomColor.toLowerCase()===(mode==='save'?'#2196f3':before.toLowerCase()),'Color no persistido o cancelar modifica color');
  });
  for(const branch of ['Cancelar','Solo nuevas','Añadir todas'])await test('playlist-selector','ALL: duplicados parciales '+branch,async()=>{
    const id=await window.mmplayer.invoke('createPlaylist',{name:'ALL duplicates '+branch});const tracks=specs['batch-menu'].tracks;
    await window.mmplayer.invoke('addToPlaylist',{playlistId:id,trackIds:[tracks[0].id]});
    await open('playlist-selector',{tracksToAssociate:tracks});await click('playlist-selector',new RegExp('^ALL duplicates '+branch));
    await alertButton(branch==='Solo nuevas'?/Solo.*nueva/i:new RegExp('^'+branch+'$'));
    const expected=branch==='Cancelar'?1:branch==='Solo nuevas'?tracks.length:tracks.length+1;let count=0;for(let i=0;i<50;i++){count=await database.get('playlist_tracks').query(Q.where('playlist_id',id)).fetchCount();if(count===expected)break;await wait(100);}assert(count===expected,'Duplicados incorrectos: '+count+' esperado '+expected);
  });
  await test('playlist-selector','ALL: editar nombre descripcion y cancelar creacion',async()=>{
    const oldName=models.playlist.name,oldDesc=models.playlist.description;
    await open('playlist-selector',{playlistToEdit:models.playlist,tracksToAssociate:[]});
    let root=menu('playlist-selector');setInput(root.querySelector('input'),'ALL renamed');setInput(root.querySelector('textarea'),'ALL description');await wait(80);await click('playlist-selector',/Guardar/);
    await until(()=>models.playlist.name==='ALL renamed','No edita nombre');assert(models.playlist.description==='ALL description','No edita descripcion');
    await database.write(()=>models.playlist.update(record=>{record.name=oldName;record.description=oldDesc;}));
    await open('playlist-selector');await click('playlist-selector','Crear nueva playlist');await click('playlist-selector','Cancelar');assert(menu('playlist-selector')&&!menu('playlist-selector').querySelector('textarea'),'Cancelar no vuelve al selector padre');
  });
  for(const mode of ['manual','context','stop','cancel'])await test('queue-manage','ALL: '+mode,async()=>{
    await seedQueue();await open('queue');await activate(document.querySelector('[data-testid="queue-manage"]'));
    const before=player.getQueueTracks().length,root=document.querySelector('[data-testid="queue-manage-options"]');assert(root,'No abre subnivel de gestion');
    await choose(root,mode==='manual'?/Borrar.*añadida/:mode==='context'?/Borrar contexto/:mode==='stop'?/Parar la reproduccion|Parar la reproducción/:/^Cancelar$/);
    if(mode==='stop')await until(()=>!player.getSnapshot().track,'No detiene');
    else if(mode==='cancel')assert(player.getQueueTracks().length===before,'Cancelar cambia cola');
    else await until(()=>player.getQueueTracks().length<before,'No elimina pistas');
  });
  for(const index of [0,1,2,3])await test('queue-save','ALL: opcion '+(index+1),async()=>{
    await seedQueue();await open('queue');await activate(document.querySelector('[data-testid="queue-save-playlist"]'));
    const root=document.querySelector('[data-testid="queue-save-options"]');assert(root,'No abre subnivel guardar cola');
    const names=['queue.save_all_to_playlist','queue.save_upcoming_to_playlist','queue.save_manual_to_playlist','actions.cancel'].map(key=>i18n.t(key));const options=names.map(name=>buttons(root).find(el=>label(el)===name));assert(options.every(Boolean),'No muestra todos los tipos de guardado');
    await activate(options[index]);
    if(index===3){assert(!document.querySelector('[data-testid="queue-save-options"]'),'No cancela');return;}
    await until(()=>menu('playlist-selector'),'No abre selector para cola');
    const entry=desktopMenus.getSnapshot().findLast(entry=>entry.type==='playlist-selector');assert(entry.props.tracksToAssociate.length>0,'Abre selector sin canciones');
    await click('playlist-selector','Crear nueva playlist');setInput(menu('playlist-selector').querySelector('input'),'ALL queue saved '+index);await wait(80);await click('playlist-selector',/Crear playlist|Crear y añadir/i);
    const lib=await window.mmplayer.invoke('library'),saved=lib.playlists.find(p=>p.name==='ALL queue saved '+index);assert(saved&&saved.trackIds.length>0,'No guarda seleccion de cola');
  });
  for(let id=0;id<5;id++)await test('queue-selector','ALL: seleccionar y renombrar cola '+(id+1),async()=>{
    await seedQueue();await open('queue');const selector=document.querySelector('[data-testid="queue-selector"]');await activate(selector);
    await activate(document.querySelector(`[data-testid="queue-slot-${id}"]`));await until(()=>player.getSnapshot().activeQueue===id,'No cambia cola');
    await activate(document.querySelector('[data-testid="queue-rename"]'));await until(()=>modal()?.querySelector('input'),'No abre renombrar');
    setInput(modal().querySelector('input'),'ALL queue '+id);await wait(80);await activate(document.querySelector('[data-testid="queue-rename-save"]'));
    await until(()=>player.getSnapshot().queues[id].name==='ALL queue '+id,'No guarda nombre');
    await activate(document.querySelector('[data-testid="queue-rename"]'));await until(()=>modal()?.querySelector('input'),'No reabre renombrar');setInput(modal().querySelector('input'),'Cancelled');await choose(modal(),/^Cancelar$/);assert(player.getSnapshot().queues[id].name==='ALL queue '+id,'Cancelar guarda cambios');
  });
  await test('queue-selector','ALL: restablecer todas cancelar y confirmar',async()=>{
    await seedQueue();await open('queue');await activate(document.querySelector('[data-testid="queue-selector"]'));await choose(document.querySelector('[data-testid="desktop-queue-sheet"]'),/Reiniciar todas/);await alertButton(/^Cancelar$/);assert(player.getSnapshot().track,'Cancelar detiene reproduccion');
    await activate(document.querySelector('[data-testid="queue-selector"]'));await choose(document.querySelector('[data-testid="desktop-queue-sheet"]'),/Reiniciar todas/);await alertButton(/^Reiniciar todas/);await until(()=>player.getSnapshot().queues.every(queue=>queue.trackIds.length===0),'No vacia todas las colas');
  });
  for(const tab of ['albums','artists','tracks','playlists','folders'])await test('sort-modal','ALL: todos los filtros y subniveles '+tab,async()=>{
    await open('sort-modal',{activeTab:tab});const root=menu('sort-modal');let interactions=0;
    // Expand every disclosure, including listening/creation date and formats.
    const headers=['sort.title',...['tracks','albums','year','duration','rating','size','listening','created','genre','formats'].map(key=>'filter_controls.'+key)].map(key=>i18n.t(key));const disclosures=buttons(root).filter(el=>headers.includes(label(el)));
    for(const el of disclosures){await activate(el);interactions++;}
    for(const input of root.querySelectorAll('input[role="switch"]')){await activate(input);assert(input.checked,'No activa filtro');interactions++;}
    // Tri-state chips are independent per filter row; press every value.
    for(const text of ['Sí','No','Todos'])for(const el of buttons(root).filter(el=>label(el)===text)){await activate(el);interactions++;}
    for(const el of buttons(root).filter(el=>/MP3|FLAC|Integration batch/.test(label(el))&&!el.querySelector('[role="button"]'))){await activate(el);interactions++;}
    const plus=buttons(root).filter(el=>/: \+$/.test(label(el)));
    for(const el of plus){await activate(el);interactions++;}
    for(const el of buttons(root).filter(el=>/: −$/.test(label(el)))){await activate(el);interactions++;}
    for(const el of buttons(root).filter(el=>/: (Ampliar|Años anteriores|Ver más|Expandir)/i.test(label(el)))){await activate(el);interactions++;}
    for(const el of buttons(root).filter(el=>/: Sin l[ií]mite$/.test(label(el)))){await activate(el);interactions++;}
    const dates=buttons(root).filter(el=>/Elegir fechas|Seleccionar fechas/.test(label(el)));
    for(const el of dates){await activate(el);await until(()=>modal(),'No abre calendario');await choose(modal(),/^Cancelar$/);interactions++;}
    await click('sort-modal','Aplicar');assert(!menu('sort-modal'),'No aplica filtros');
    const filters=tab==='albums'?useLibraryStore.getState().albumFilters:useLibraryStore.getState().sectionFilters[tab];assert(filters,'No persiste filtros');
    await open('sort-modal',{activeTab:tab});await click('sort-modal','Limpiar filtros');await click('sort-modal','Aplicar');
    assert(interactions>=5,'No recorre filtros: '+interactions);return interactions+' interacciones: desplegables, chips, limites, ampliacion, fechas y guardar/limpiar';
  },20000);
  for(const [sheet,option] of [['track-menu','Compartir'],['batch-menu','Compartir selección como ZIP'],['lyrics-menu','Exportar archivo .LRC']])await test(sheet,'ALL: archivo fisico '+option,async()=>{
    await open(sheet);window.__sheetLastSavedFile=null;await click(sheet,option);await until(()=>window.__sheetLastSavedFile,'No solicita guardar archivo');
    const path=window.__sheetLastSavedFile;for(let i=0;i<30;i++){const info=await FileSystem.getInfoAsync(path);if(info.exists&&info.size>0)return 'Boton pulsado y archivo real guardado ('+info.size+' bytes)';await wait(100);}throw Error('No escribe archivo');
  },12000);
  await test('metadata-editor','ALL: elegir y quitar caratula y botones de copiar campos',async()=>{
    await open('metadata-editor');await wait(250);const root=menu('metadata-editor');
    const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7ioAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
    const imageButton=buttons(root).find(el=>getComputedStyle(el).width==='32px'&&getComputedStyle(el).height==='32px');
    assert(imageButton,'No encuentra boton para elegir imagen');await selectFile('metadata-editor',imageButton,new File([bytes],'all-cover.png',{type:'image/png'}));
    const remove=buttons(root).filter(el=>getComputedStyle(el).width==='32px'&&getComputedStyle(el).height==='32px')[1];assert(remove,'No ofrece quitar imagen');await activate(remove);
    await click('metadata-editor','Guardar');await until(()=>!menu('metadata-editor'),'No guarda retirada de caratula');
  });
  for(const branch of ['cancel','existing','upload'])await test('canvas-duplicate','ALL: '+branch,async()=>{
    await reset();const canvas=document.createElement('canvas');canvas.width=24;canvas.height=24;const ctx=canvas.getContext('2d');const stream=canvas.captureStream(8),chunks=[],recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
    const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));});recorder.start();ctx.fillStyle='#123456';ctx.fillRect(0,0,24,24);await wait(220);recorder.stop();const blob=await done;stream.getTracks().forEach(track=>track.stop());
    const original=await MediaAssetService.saveNewCanvasVideo(URL.createObjectURL(blob)),before=(await MediaAssetService.getAllUploadedCanvasVideos()).length;
    await open('canvas-manager');await selectFile('canvas-manager','Subir nuevo vídeo',new File([blob],'same.webm',{type:'video/webm'}));
    await alertButton(branch==='cancel'?/^Cancelar$/:branch==='existing'?/Continuar y usar existente/:/Subir de nuevo/);await wait(350);
    const after=(await MediaAssetService.getAllUploadedCanvasVideos()).length;assert(after===before+(branch==='upload'?1:0),'Duplicado ocupa espacio incorrecto');
    if(branch!=='cancel')assert(models.track.bgVideo,'No asigna video');
    await open('canvas-manager');await until(()=>menu('canvas-manager').querySelector('[data-testid="canvas-grid-item"]'),'No hay video en galeria');
    const card=menu('canvas-manager').querySelector('[data-testid="canvas-grid-item"]');await interact(card);await until(()=>models.track.bgVideo,'No asigna al seleccionar miniatura');await wait(500);
    await open('canvas-manager');await until(()=>menu('canvas-manager')?.querySelector('[data-testid="canvas-grid-item"]'),'No reabre galeria');await interact(menu('canvas-manager').querySelector('[data-testid="canvas-grid-item"]'),650);await alertButton(/^Cancelar$/);
    const count=(await MediaAssetService.getAllUploadedCanvasVideos()).length;await interact(menu('canvas-manager').querySelector('[data-testid="canvas-grid-item"]'),650);await alertButton(/^Eliminar$/);await wait(250);assert((await MediaAssetService.getAllUploadedCanvasVideos()).length===count-1,'No elimina video de galeria');
  },20000);
  await test('custom-date','ALL: calendario meses dias inicio fin aplicar y cancelar',async()=>{
    await reset();let selected=null;useCustomDateModalStore.getState().open({restrictToHistory:false,onApply:(from,to)=>{selected={from,to};}});await until(()=>modal(),'No abre calendario');
    await choose(modal(),/Mes anterior/);await choose(modal(),/Mes siguiente/);await choose(modal(),/Mes anterior/);
    const monthButton=buttons(modal()).find(el=>/^[a-záéíóú]+ \d{4}$/i.test(label(el)));assert(monthButton,'No abre selector de meses');await activate(monthButton);
    const yearControls=buttons(modal()).filter(el=>['','DIV'].includes(label(el))&&getComputedStyle(el).width==='32px'&&el.getAttribute('aria-disabled')!=='true');assert(yearControls.length,'No hay navegacion anual');await activate(yearControls[0]);
    const months=buttons(modal()).filter(el=>/^(ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)\.?$/i.test(label(el)));assert(months.length===12,'No hay doce meses');
    for(let index=0;index<12;index++){if(index){const title=buttons(modal()).find(el=>/^[a-záéíóú]+ \d{4}$/i.test(label(el)));await activate(title);}const choices=buttons(modal()).filter(el=>/^(ene|feb|mar|abr|may|jun|jul|ago|sept?|oct|nov|dic)\.?$/i.test(label(el)));await activate(choices[index]);}await wait(80);
    const days=buttons(modal()).filter(el=>/^\d{1,2}$/.test(label(el))&&el.getAttribute('aria-disabled')!=='true');assert(days.length,'No hay dias elegibles');for(const day of days)await activate(day);
    await choose(modal(),/Aplicar|Aceptar/);assert(selected&&selected.from<=selected.to,'No aplica rango valido');
    selected=null;useCustomDateModalStore.getState().open({restrictToHistory:false,onApply:()=>{selected=true;}});await until(()=>modal(),'No reabre calendario');await choose(modal(),/^Cancelar$/);assert(!selected&&!useCustomDateModalStore.getState().isVisible,'Cancelar aplica rango');
    return 'Navegacion mensual, selector rapido, dias habilitados, aplicar y cancelar';
  },20000);
  await test('track-menu','ALL: quitar de playlist y alternar favoritos y aleatorio',async()=>{
    const id=await window.mmplayer.invoke('createPlaylist',{name:'ALL remove song'});await window.mmplayer.invoke('addToPlaylist',{playlistId:id,trackIds:[models.track.id]});
    await open('track-menu',{...specs['track-menu'],playlistId:id});await click('track-menu',/Eliminar de esta lista/);assert(await database.get('playlist_tracks').query(Q.where('playlist_id',id)).fetchCount()===0,'No quita la pista');
    for(let i=0;i<2;i++){await open('track-menu');const before=models.track.isFavorite;await click('track-menu',/favoritos/);await until(()=>models.track.isFavorite!==before,'No alterna favorito');}
    for(let i=0;i<2;i++){await open('track-menu');const before=models.track.isExcludedFromShuffle;await click('track-menu',/aleatori/);await until(()=>models.track.isExcludedFromShuffle!==before,'No alterna aleatorio');}
  });
  for(const target of ['album','batch'])await test('tag-manager','ALL: asociar y desasociar '+target,async()=>{
    const props=target==='album'?{targetType:'album',targetId:models.album.id,targetTitle:models.album.title}:{targetType:'batch',targetId:'batch',targetTitle:'ALL batch',tracks:specs['batch-menu'].tracks};
    const table=target==='album'?'album_tags':'track_tags',column=target==='album'?'album_id':'track_id',id=target==='album'?models.album.id:models.track.id;
    for(let i=0;i<2;i++){const before=await database.get(table).query(Q.where(column,target==='batch'?Q.oneOf(specs['batch-menu'].tracks.map(track=>track.id)):id),Q.where('tag_id',models.tag.id)).fetchCount();await open('tag-manager',props);await click('tag-manager',models.tag.name);if(target==='album')await alertButton(/Solo.*álbum|Solo.*album/i);let after=before;for(let j=0;j<50;j++){after=await database.get(table).query(Q.where(column,target==='batch'?Q.oneOf(specs['batch-menu'].tracks.map(track=>track.id)):id),Q.where('tag_id',models.tag.id)).fetchCount();if(after!==before)break;await wait(100);}assert(before!==after,'No cambia asociacion');}
  });
  await test('queue','ALL: eliminar deshacer reordenar reproducir e interruptor final',async()=>{
    await seedQueue();await open('queue');const root=document.querySelector('[data-testid="desktop-queue-sheet"]');
    const before=player.getQueueTracks().length,remove=root.querySelector('[data-testid^="queue-remove-"]');assert(remove,'No hay pista eliminable');await activate(remove);await until(()=>player.getQueueTracks().length<before,'No elimina fila');
    await choose(document,/^Deshacer$/);await until(()=>player.getQueueTracks().length===before,'No restaura fila');
    const rows=[...root.querySelectorAll('[draggable="true"]')];assert(rows.length>=2,'No hay dos filas para reordenar');const queue=()=>player.getSnapshot().queues[player.getSnapshot().activeQueue];const order=JSON.stringify(queue().trackIds);
    rows[0].dispatchEvent(new DragEvent('dragstart',{bubbles:true,dataTransfer:new DataTransfer()}));await wait(100);rows[1].dispatchEvent(new DragEvent('dragover',{bubbles:true,dataTransfer:new DataTransfer()}));await wait(100);rows[1].dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:new DataTransfer()}));await wait(150);assert(JSON.stringify(queue().trackIds)!==order,'No persiste orden');
    const toggle=root.querySelector('input[role="switch"]');const was=toggle.checked;await activate(toggle);assert(toggle.checked!==was&&queue().shuffleOnEnd===toggle.checked,'No cambia aleatorio al final');await activate(toggle);
    const play=root.querySelector('[data-testid^="queue-play-"]');const oldIndex=queue().index;await activate(play);await until(()=>queue().index!==oldIndex,'No reproduce fila elegida');
  });
  // Close and Escape are checked for every registered desktop sheet, not just root menus.
  for(const sheet of Object.keys(specs).filter(type=>!['local-cast','queue'].includes(type)))await test(sheet,'ALL: cerrar con X y Escape',async()=>{
    await open(sheet);await click(sheet,'Cancelar');assert(!menu(sheet),'X no cierra');
    await open(sheet);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await wait(100);assert(!menu(sheet),'Escape no cierra');
  });
  await reset();useQueueRenameModalStore.getState().close();useCustomDateModalStore.getState().close();useColorPickerModalStore.getState().close();
}
