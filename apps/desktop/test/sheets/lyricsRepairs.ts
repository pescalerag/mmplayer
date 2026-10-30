// @ts-nocheck -- UI integration against the actual Electron renderer and SQLite.
import * as FileSystem from '../../src/renderer/ports/fileSystem';
import { database } from '../../src/renderer/ports/database';
import { player } from '../../src/renderer/player';
import { usePlayerStore } from '../../src/renderer/ports/playerStore';
import { navigationRef } from '../../src/renderer/ports/navigationRef';
import i18n from '../../../../src/constants/i18n';

export async function runLyricsRepairs(h) {
  const {test,open,click,reset,wait,until,assert,buttons,label,menu,setInput,models,specs}=h;
  const screen=name=>document.querySelector(`[data-testid="mobile-screen-${name}"]`);
  const press=async(root,expression)=>{const el=buttons(root).filter(el=>expression.test(label(el))).at(-1);assert(el,'No aparece '+expression);el.click();await wait(150);};
  const confirm=expression=>press(document,expression);
  const enter=async(type)=>{await open('lyrics-menu');await click('lyrics-menu',type==='LyricsEditor'?'Editar letras':'Sincronizar letras');await until(()=>screen(type),'No abre '+type);await wait(250);};
  const start=async()=>{const lib=await window.mmplayer.invoke('library');const track=lib.tracks.find(track=>track.id===models.track.id);await player.start([track],0,false);await until(()=>usePlayerStore.getState().activeTrack?.id===track.id,'No prepara pista');};

  await test('lyrics-documents','REPAIR: editar guardar reabrir y proteger cambios',async()=>{
    const original=models.track.lyricsLRC;
    try {
      await enter('LyricsEditor');await until(()=>screen('LyricsEditor').querySelector('textarea'),'No carga texto');
      const value='[ar:Prueba]\n[00:00.20]Primera línea editada\n[00:00.60]Segunda línea';
      setInput(screen('LyricsEditor').querySelector('textarea'),value);await wait(100);await press(screen('LyricsEditor'),/^Guardar$/);
      await until(()=>models.track.lyricsLRC===value,'No guarda letras en SQLite');await confirm(/^OK$/);await until(()=>!screen('LyricsEditor'),'No vuelve tras guardar');
      await enter('LyricsEditor');assert(screen('LyricsEditor').querySelector('textarea').value===value,'No recupera texto guardado');
      setInput(screen('LyricsEditor').querySelector('textarea'),'Cambios sin guardar');await wait(100);
      document.querySelector('[data-testid="header-history-back"]').click();await wait(100);assert(screen('LyricsEditor'),'Descarta sin confirmar');await confirm(/^Cancelar$/);assert(screen('LyricsEditor').querySelector('textarea').value==='Cambios sin guardar','Cancelar pierde el borrador');
      document.querySelector('.sidebar nav button').click();await wait(100);await confirm(/^Descartar$/);await until(()=>!screen('LyricsEditor'),'No sale al confirmar');assert(models.track.lyricsLRC===value,'Descartar modifica SQLite');
      await enter('LyricsEditor');document.querySelector('[data-testid="header-history-back"]').click();await until(()=>!screen('LyricsEditor'),'El documento limpio queda bloqueado');
      return 'Editar y persistir texto real; reapertura, cancelar salida, descartar por barra lateral y volver sin cambios';
    } finally {await reset();await database.write(()=>models.track.update(track=>{track.lyricsLRC=original;}));}
  },20000);

  await test('lyrics-documents','REPAIR: sincronizar marcar deshacer reiniciar y guardar LRC',async()=>{
    const original=models.track.lyricsLRC;
    try {
      await reset();await database.write(()=>models.track.update(track=>{track.lyricsLRC='[ar:Prueba]\nPrimera frase\nSegunda frase';}));await start();await enter('LyricsSync');
      await until(()=>screen('LyricsSync').querySelector('[data-testid="lyrics-sync-mark"]')?.getAttribute('aria-disabled')!=='true','No habilita sincronizador');
      const control=id=>screen('LyricsSync').querySelector(`[data-testid="lyrics-sync-${id}"]`);
      const record=async(position)=>{player.seek(position);await wait(160);control('mark').click();await wait(120);};
      await record(.35);assert(control('undo').getAttribute('aria-disabled')!=='true','No habilita deshacer');control('undo').click();await wait(100);assert(control('undo').getAttribute('aria-disabled')==='true','No deshace marca');
      await record(.35);control('reset').click();await wait(100);await confirm(/^Cancelar$/);assert(control('undo').getAttribute('aria-disabled')!=='true','Cancelar reinicio borra tiempos');
      control('reset').click();await wait(100);await confirm(/^Confirmar$/);assert(control('undo').getAttribute('aria-disabled')==='true','No reinicia tiempos');
      await record(.35);await record(.65);await press(screen('LyricsSync'),/^Guardar$/);
      await until(()=>models.track.lyricsLRC.includes('[00:'),'No guarda marcas LRC');
      const saved=models.track.lyricsLRC;assert(saved.startsWith('[ar:Prueba]')&&saved.includes('Primera frase')&&saved.includes('Segunda frase'),'Pierde cabeceras o frases');assert((saved.match(/\[\d{2}:\d{2}\.\d{2,3}\]/g)||[]).length===2,'No guarda ambas marcas');
      const raw=await window.mmplayer.invoke('library');assert(raw.tracks.find(track=>track.id===models.track.id).lyricsLRC===saved,'LRC no persistido en biblioteca');
      await confirm(/^OK$/);await until(()=>!screen('LyricsSync'),'No sale al guardar');assert(!usePlayerStore.getState().isSyncingLyrics,'No libera modo de sincronizacion');
      return 'Cancion real del reproductor, seek, dos marcas, deshacer, reinicio cancelado/confirmado y LRC persistido';
    } finally {await reset();await database.write(()=>models.track.update(track=>{track.lyricsLRC=original;}));}
  },20000);

  await test('lyrics-documents','REPAIR: confirmacion de borrado traducida en tres idiomas',async()=>{
    const language=i18n.language,original=models.track.lyricsLRC;
    const words={es:['Atención','Confirmar','Cancelar'],en:['Warning','Confirm','Cancel'],pt:['Atenção','Confirmar','Cancelar']};
    try {for(const language of ['es','en','pt']) {
      await i18n.changeLanguage(language);await open('lyrics-menu');await click('lyrics-menu',i18n.t('lyrics.delete_lyrics'));
      const [title,yes,cancel]=words[language];assert(document.body.innerText.includes(title),'Titulo sin traducir '+language);assert(buttons().some(el=>label(el)===yes),'Confirmar sin traducir '+language);assert(!document.body.innerText.includes('actions.warning')&&!document.body.innerText.includes('actions.confirm'),'Claves sin traducir');await confirm(new RegExp('^'+cancel+'$'));assert(models.track.lyricsLRC===original,'Cancelar borra letras');
    }} finally {await i18n.changeLanguage(language);await reset();}
  },15000);
  await test('metadata-editor','REPAIR: buscar caratula real guardar y cancelar sustitucion',async()=>{
    await open('metadata-editor');await until(()=>menu('metadata-editor')?.querySelectorAll('input').length>=8,'No carga metadatos');await wait(300);
    let root=menu('metadata-editor');const fields=[...root.querySelectorAll('input')],original=fields.map(input=>input.value);
    setInput(fields[3],'Daft Punk');setInput(fields[4],'Discovery');setInput(fields[5],'Daft Punk');await wait(100);
    const requests=[],originalFetch=window.fetch;
    window.fetch=async(...args)=>{const response=await originalFetch(...args);if(String(args[0]).includes('api.deezer.com'))requests.push(response.status);return response;};
    try {
      await click('metadata-editor','Buscar carátula en internet');
      const replacement=buttons().filter(el=>!el.closest('[data-desktop-menu-id]')&&/^Reemplazar/.test(label(el))).at(-1);if(replacement){replacement.click();await wait(100);}
      for(let i=0;i<160;i++){if(requests.includes(200)&&menu('metadata-editor')?.querySelector('img')&&buttons(menu('metadata-editor')).some(el=>label(el)==='Buscar carátula en internet'&&el.getAttribute('aria-disabled')!=='true'))break;await wait(100);}
      assert(requests.includes(200),'Deezer no devuelve resultados');assert(menu('metadata-editor').querySelector('img'),'No previsualiza caratula');
      // Keep the song's own text metadata while applying the downloaded artwork.
      root=menu('metadata-editor');const inputs=[...root.querySelectorAll('input')];for(const index of [3,4,5])setInput(inputs[index],original[index]);await wait(100);
      await click('metadata-editor','Guardar');await until(()=>!menu('metadata-editor'),'No guarda caratula');
      const snapshot=await window.mmplayer.invoke('library'),track=snapshot.tracks.find(track=>track.id===models.track.id);assert(track.cover,'No incorpora caratula al archivo');assert((await FileSystem.getInfoAsync(track.cover)).size>0,'Caratula guardada vacia');
      await open('metadata-editor');await wait(350);const count=requests.length;await click('metadata-editor','Buscar carátula en internet');await confirm(/^Cancelar$/);assert(requests.length===count,'Cancelar sustitucion inicia descarga');
      return 'Deezer real, descarga, previsualizacion, guardado fisico y confirmacion de reemplazo cancelada';
    } finally {window.fetch=originalFetch;await reset();}
  },30000);

}
