// @ts-nocheck -- Actual persistent footer, native input, sheets and player stores.
import { player } from '../../src/renderer/player';
import { useSleepTimerStore } from '../../src/renderer/ports/sleepTimer';
import { useABRepeatStore } from '../../src/renderer/ports/abRepeat';
import { usePlayerStore } from '../../src/renderer/ports/playerStore';
import { desktopMenus } from '../../src/renderer/desktopMenus';

export async function runFooterFunctions(h) {
  const {test,reset,wait,until,assert,models,menu,click}=h;
  const ids=['desktop-sleep-timer','desktop-speed-pitch','desktop-toggle-lyrics','desktop-ab-repeat','desktop-share-track','desktop-open-queue','desktop-toggle-player'];
  const button=id=>document.querySelector(`[data-testid="${id}"]`);
  async function start(){await reset();const lib=await window.mmplayer.invoke('library');await player.start(lib.tracks,0,false);await wait(150);}
  await test('footer-functions','FOOTER: orden ubicacion y funcionamiento de los seis controles',async()=>{
    const preferences=(await window.mmplayer.invoke('state')).preferences;
    try {
      await start();await window.mmplayer.invoke('preferences',{playerVisible:true});await wait(250);
      const found=[...document.querySelector('[data-testid="desktop-player-functions"]').querySelectorAll('[data-testid]')].map(el=>el.dataset.testid);assert(JSON.stringify(found)===JSON.stringify(ids),'Orden incorrecto: '+found);
      assert(!document.querySelector('.player-panel [data-testid="player-toggle-lyrics"],.player-panel [data-testid="player-open-queue"]'),'PlayerScreen duplica funciones');
      const spacer=document.querySelector('.player-panel [data-testid="desktop-player-info-spacer"]');assert(spacer&&spacer.getBoundingClientRect().height>=16,'Falta margen bajo informacion');
      const add=button('footer-add-to-playlist'),heart=document.querySelector('.footer-heart-button');assert(add.getBoundingClientRect().left>=heart.getBoundingClientRect().right,'Añadir playlist no esta junto al corazon');
      const pid=await window.mmplayer.invoke('createPlaylist',{name:'Footer added song'});add.click();await until(()=>menu('playlist-selector'),'No abre selector desde +');await click('playlist-selector',/^Footer added song/);
      let saved=false;for(let i=0;i<30;i++){const lib=await window.mmplayer.invoke('library');if(lib.playlists.find(list=>list.id===pid)?.trackIds.includes(player.getSnapshot().track.id)){saved=true;break;}await wait(100);}assert(saved,'No añade la cancion actual a la playlist');desktopMenus.clear();
      await window.mmplayer.invoke('preferences',{playerVisible:false});await wait(150);
      button(ids[0]).click();await until(()=>menu('sleep-timer'),'No abre temporizador');await click('sleep-timer','5 min');assert(useSleepTimerStore.getState().isActive&&button(ids[0]).getAttribute('aria-pressed')==='true','Temporizador no se refleja');useSleepTimerStore.getState().deactivate();desktopMenus.clear();
      button(ids[1]).click();await until(()=>menu('speed-pitch'),'No abre velocidad');await usePlayerStore.getState().setPlaybackSpeed(1.25);await wait(100);assert(button(ids[1]).getAttribute('aria-pressed')==='true','Velocidad activa no se refleja');await usePlayerStore.getState().setPlaybackSpeed(1);desktopMenus.clear();
      button(ids[2]).click();await until(()=>document.querySelector('[data-testid="mobile-screen-Lyrics"]'),'No abre letras');assert(button(ids[2]).getAttribute('aria-pressed')==='true','Letras no se reflejan');button(ids[2]).click();await until(()=>!document.querySelector('[data-testid="mobile-screen-Lyrics"]'),'No cierra letras');
      player.seek(.03);await wait(80);button(ids[3]).click();await until(()=>useABRepeatStore.getState().pointA!==null,'No marca A');player.seek(.20);await wait(80);button(ids[3]).click();await until(()=>useABRepeatStore.getState().pointB!==null,'No marca B');
      const rect=button(ids[3]).getBoundingClientRect(),id='footer-ab-hold';console.log('SHEET_INPUT '+JSON.stringify({id,x:Math.round(rect.x+rect.width/2),y:Math.round(rect.y+rect.height/2),hold:450}));await until(()=>window.__sheetInputDone===id,'No llega pulsacion larga');assert(useABRepeatStore.getState().pointA===null&&useABRepeatStore.getState().pointB===null,'Pulsacion larga no desactiva AB');
      button(ids[4]).click();await until(()=>document.querySelector('[data-testid="mobile-screen-ShareSong"]'),'No abre compartir');assert(document.querySelector('[data-testid="mobile-screen-ShareSong"]').textContent.includes(player.getSnapshot().track.title),'Comparte otra cancion');await reset();
      await window.mmplayer.invoke('preferences',{playerVisible:false});await wait(100);assert(!document.querySelector('.player-panel'),'No cierra panel');button(ids[5]).click();await until(()=>document.querySelector('.player-panel [data-testid="desktop-queue-sheet"]'),'Cola no abre panel derecho');assert(button(ids[5]).getAttribute('aria-pressed')==='true','Cola no se refleja');
      button(ids[5]).click();await until(()=>!document.querySelector('[data-testid="desktop-queue-sheet"]'),'No cierra cola');assert(document.querySelector('.player-panel'),'Cerrar cola cierra el panel');
      assert(!document.querySelector('.desktop-view-controls'),'Sigue boton de reproductor en barra izquierda');
      button(ids[6]).click();await until(()=>!document.querySelector('.player-panel'),'Flecha no cierra panel');assert(button(ids[6]).getAttribute('aria-expanded')==='false','Estado de flecha incorrecto');
      button(ids[6]).click();await until(()=>document.querySelector('.player-panel'),'Flecha no abre panel');assert(button(ids[6]).getAttribute('aria-expanded')==='true','No refleja panel abierto');
      return 'Seis funciones en orden, playlist añadida desde + junto al corazon, margen de informacion, AB corto/largo, letras, compartir y cola con panel cerrado';
    } finally {useSleepTimerStore.getState().deactivate();useABRepeatStore.getState().reset();await usePlayerStore.getState().setPlaybackSpeed(1);await window.mmplayer.invoke('preferences',preferences);await reset();}
  },22000);
  await test('footer-functions','FOOTER: controles a la izquierda del volumen sin solaparse con zoom',async()=>{
    const preferences=(await window.mmplayer.invoke('state')).preferences;
    try {
      await start();
      for(const width of [1400,900]) {
        const id='footer-size-'+width;console.log('SHEET_SIZE '+JSON.stringify({id,width,height:800}));await until(()=>window.__sheetSizeDone===id,'No cambia ventana');
        for(const zoomFactor of [.7,1,1.3]) {
          await window.mmplayer.invoke('preferences',{zoomFactor});await wait(180);
          const footer=document.querySelector('.bottom-player').getBoundingClientRect(),volume=document.querySelector('.volume').getBoundingClientRect(),transport=document.querySelector('.footer-transport').getBoundingClientRect();
          assert(Math.abs((transport.left+transport.width/2)-(footer.left+footer.width/2))<1.5,'Transporte no centrado respecto a la barra');
          const rects=ids.map(id=>button(id).getBoundingClientRect());
          for(let i=0;i<rects.length;i++){const r=rects[i];assert(r.width>=24&&r.height>=24,'Control pequeno');assert(r.left>=footer.left&&r.right<=volume.left&&r.top>=footer.top&&r.bottom<=footer.bottom,'Control fuera del reproductor o a la derecha del volumen');assert(!i||rects[i-1].right<=r.left+1,'Orden visual o solapamiento incorrecto');assert(r.right<=transport.left||r.left>=transport.right||r.top>=transport.bottom||r.bottom<=transport.top,'Se solapa con el transporte');}
          assert(volume.right<=footer.right,'Volumen fuera de pantalla');
        }
      }
      const id='footer-layout';console.log('SHEET_PIXEL '+JSON.stringify({id,x:10,y:innerHeight-10}));await until(()=>window.__sheetPixel?.id===id,'No captura disposicion');
      return 'Ventanas de 1400 y 900, zoom 70/100/130%, orden visual y volumen sin controles superpuestos';
    } finally {const id='footer-size-restore';console.log('SHEET_SIZE '+JSON.stringify({id,restore:true}));await until(()=>window.__sheetSizeDone===id,'No restaura ventana');await window.mmplayer.invoke('preferences',preferences);await reset();}
  },22000);
}
