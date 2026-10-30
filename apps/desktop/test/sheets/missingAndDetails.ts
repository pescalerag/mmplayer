// @ts-nocheck -- Real disk disappearance, shared confirmation and responsive detail screens.
import { database } from '../../src/renderer/ports/database';
import { reviewMissingDesktopFiles } from '../../src/renderer/ports/scannerService';
import { navigationRef } from '../../src/renderer/ports/navigationRef';
import { useMigrationStore } from '../../../../src/store/useMigrationStore';
import i18n from '../../../../src/constants/i18n';

export async function runMissingAndDetails(h) {
  const {test,reset,wait,until,assert,models,buttons,label,specs}=h;
  await test('missing-files','MISSING-DETAILS: confirmar conservar reintentar restaurar y eliminar de DB',async()=>{
    let removed=false;
    const disk=async op=>{const id=op+'-'+Date.now();console.log('SHEET_MISSING '+JSON.stringify({id,op}));await until(()=>window.__sheetMissing?.id===id,'No cambia carpeta fisica');return window.__sheetMissing;};
    const choose=async key=>{const text=i18n.t('migration.'+key);const button=buttons().filter(el=>label(el)===text).at(-1);assert(button,'No aparece '+text);button.click();await wait(100);};
    try {
      await reset();const before=new Set((await window.mmplayer.invoke('library')).tracks.map(t=>t.id));await disk('create');await window.mmplayer.invoke('pickMusic',{folders:true});await wait(200);
      const snapshot=await window.mmplayer.invoke('library'),track=snapshot.tracks.find(t=>!before.has(t.id));assert(track,'No importa fixture');
      const model=await database.get('tracks').find(track.id);await database.write(()=>model.update(t=>{t.rating=4.5;t.isFavorite=true;}));
      await disk('remove');removed=true;
      let review=reviewMissingDesktopFiles();await until(()=>useMigrationStore.getState().phase==='confirm_delete','No pide confirmacion');
      assert(document.body.innerText.includes(i18n.t('migration.unresolved_title')),'No muestra dialogo movil');
      assert((await window.mmplayer.invoke('library')).tracks.some(t=>t.id===track.id),'Borra sin confirmar');
      await choose('keep_and_continue');await review;
      assert((await window.mmplayer.invoke('library')).tracks.find(t=>t.id===track.id)?.rating===4.5,'Conservar pierde datos');
      review=reviewMissingDesktopFiles();await until(()=>useMigrationStore.getState().phase==='confirm_delete','No vuelve a preguntar');await disk('restore');removed=false;await choose('moved_files');await review;
      assert(!useMigrationStore.getState().isVisible,'No cierra tras recuperar archivos');assert((await window.mmplayer.invoke('library')).tracks.find(t=>t.id===track.id)?.isFavorite,'Recuperar pierde favorito');
      await disk('remove');removed=true;
      await window.mmplayer.invoke('scan');await until(()=>useMigrationStore.getState().phase==='confirm_delete','Sincronizar no pregunta');review=reviewMissingDesktopFiles();await choose('delete_from_library');await review;
      const after=await window.mmplayer.invoke('library');assert(!after.tracks.some(t=>t.id===track.id),'Confirmar no elimina cancion');assert(after.tracks.some(t=>t.id===models.track.id),'Borra canciones presentes');
      assert(!useMigrationStore.getState().isVisible,'No cierra confirmacion');
      return 'Carpeta real retirada: conservar mantiene favorito y puntuacion; reintentar recupera archivo; sincronizar pregunta y solo confirmar elimina de DB';
    } finally {if(useMigrationStore.getState().resolveConfirm)useMigrationStore.getState().handleConfirmResponse('keep');if(removed)await disk('restore');await reset();}
  },22000);
  await test('detail-headers','MISSING-DETAILS: cabeceras compactas en todas las pantallas y zoom',async()=>{
    const prefs=(await window.mmplayer.invoke('state')).preferences;
    try {
      await reset();await window.mmplayer.invoke('preferences',{playerVisible:true});
      for(const [width,height] of [[900,640],[1280,800],[1920,1080]]) {
        const id='details-'+width;console.log('SHEET_SIZE '+JSON.stringify({id,width,height}));await until(()=>window.__sheetSizeDone===id,'No cambia ventana');
        for(const zoomFactor of [.7,1,1.3]) {
          await window.mmplayer.invoke('preferences',{zoomFactor});await wait(150);
          for(const [name,params] of [['AlbumDetail',{albumId:models.album.id}],['ArtistDetail',{artistId:models.artist.id}],['PlaylistDetail',{playlistId:models.playlist.id}],['FolderDetail',{folderPath:specs['folder-menu'].folderPath}]]) {
            navigationRef.navigate(name,params);await until(()=>document.querySelector(`[data-testid="mobile-screen-${name}"] [data-testid="detail-header"]`),'No aparece '+name);await wait(100);
            const screen=document.querySelector(`[data-testid="mobile-screen-${name}"]`),header=screen.querySelector('[data-testid="detail-header"]'),s=screen.getBoundingClientRect(),r=header.getBoundingClientRect();
            assert(r.height<=500.5,'Cabecera demasiado alta');assert(r.bottom<s.bottom-45,'Cabecera no deja espacio para contenido: '+name+' '+width+' '+zoomFactor+' '+JSON.stringify({s:s.toJSON(),r:r.toJSON()}));
          }
        }
      }
      const id='details-compact';console.log('SHEET_PIXEL '+JSON.stringify({id,x:10,y:100}));await until(()=>window.__sheetPixel?.id===id,'No captura cabecera');
      return 'Album, artista, playlist y carpeta: 900/1280/1920 px y zoom 70/100/130%; cabeceras hasta 500px con espacio inicial para contenido';
    } finally {const id='details-restore';console.log('SHEET_SIZE '+JSON.stringify({id,restore:true}));await until(()=>window.__sheetSizeDone===id,'No restaura ventana');await window.mmplayer.invoke('preferences',prefs);await reset();}
  },35000);
}
