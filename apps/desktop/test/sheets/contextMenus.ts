// @ts-nocheck -- Native mouse input against shared cards, rows and contextual menu levels.
import { desktopMenus } from '../../src/renderer/desktopMenus';
import { navigationRef } from '../../src/renderer/ports/navigationRef';
import { player } from '../../src/renderer/player';
import i18n from '../../../../src/constants/i18n';

export async function runContextMenus(h) {
  const {test,reset,wait,until,assert,models,menu,buttons,label}=h;
  async function prepare(){await reset();const id='context-window';console.log('SHEET_SIZE '+JSON.stringify({id,width:1600,height:1000}));await until(()=>window.__sheetSizeDone===id,'No cambia ventana');await window.mmplayer.invoke('preferences',{zoomFactor:1,playerVisible:false});await wait(150);}
  async function input(element,button='right',hold=0){element.scrollIntoView({block:'center'});await wait(100);const r=element.getBoundingClientRect(),x=Math.round(r.left+Math.min(32,r.width/3)),y=Math.round(r.top+Math.min(32,r.height/2)),id='context-'+Date.now();console.log('SHEET_INPUT '+JSON.stringify({id,x,y,button,hold}));await until(()=>window.__sheetInputDone===id,'No llega raton');return {x,y};}
  function position(type,point){const root=menu(type),entry=desktopMenus.getSnapshot().at(-1),r=root.getBoundingClientRect();assert(entry.anchor.point&&Math.abs(entry.anchor.x-point.x)<1&&Math.abs(entry.anchor.y-point.y)<1,'No usa punto del raton');assert(Math.abs(r.left-Math.max(8,Math.min(point.x,innerWidth-r.width-8)))<2,'Menu no aparece junto al raton');assert(Math.abs(r.top-Math.max(8,Math.min(point.y,innerHeight-r.height-8)))<2,'Altura de menu incorrecta');}
  async function restore(prefs){desktopMenus.clear();const id='context-restore';console.log('SHEET_SIZE '+JSON.stringify({id,restore:true}));await until(()=>window.__sheetSizeDone===id,'No restaura ventana');await window.mmplayer.invoke('preferences',prefs);await reset();}
  await test('context-menus','CONTEXT-MENUS: clic derecho tarjetas biblioteca etiquetas inicio y pulsacion larga',async()=>{
    const prefs=(await window.mmplayer.invoke('state')).preferences;
    try {
      await prepare();
      for(const [tab,type,title] of [['albums','album-menu',models.album.title],['artists','artist-menu',models.artist.name],['playlists','playlist-menu',models.playlist.name],['folders','folder-menu','music']]){
        navigationRef.navigate('Library');await until(()=>document.querySelector(`[data-testid="library-tab-${tab}"]`),'No aparece tab '+tab);document.querySelector(`[data-testid="library-tab-${tab}"]`).click();await wait(300);
        const card=()=>[...document.querySelectorAll('.center [data-context-menu-trigger="true"]')].find(el=>{const r=el.getBoundingClientRect(),c=document.querySelector('.center').getBoundingClientRect();return el.textContent.includes(title)&&r.width>0&&r.left>=c.left&&r.right<=c.right;});await until(card,'No aparece tarjeta '+tab);
        const active=player.getSnapshot().track?.id,point=await input(card());await until(()=>menu(type),'No abre '+type);position(type,point);assert(player.getSnapshot().track?.id===active,'Clic derecho reproduce o navega');assert(desktopMenus.getSnapshot().length===1,'Duplica menu');desktopMenus.clear();await wait(100);
        if(tab==='albums'){await input(card(),'left',650);await until(()=>menu(type),'Pulsacion larga no abre album');desktopMenus.clear();}
      }
      navigationRef.navigate('Tags');await wait(300);const tag=()=>[...document.querySelectorAll('.center [data-context-menu-trigger="true"]')].find(el=>el.textContent.includes(models.tag.name));await until(tag,'No aparece etiqueta');const point=await input(tag());await until(()=>menu('tag-menu'),'Clic derecho no abre etiqueta');position('tag-menu',point);desktopMenus.clear();
      navigationRef.navigate('Home');await wait(350);const recent=()=>document.querySelector('.center [data-testid="home-recent-media-card"][data-context-menu-trigger="true"]');await until(recent,'No aparece tarjeta reciente');const homePoint=await input(recent());await until(()=>desktopMenus.getSnapshot().length===1,'Inicio no abre menu');position(desktopMenus.getSnapshot()[0].type,homePoint);
      return 'Albums/artistas/playlists/carpetas/etiquetas/Inicio: clic derecho abre una vez en el raton sin reproducir; pulsacion larga de album conservada';
    } finally {await restore(prefs);}
  },26000);
  await test('context-menus','CONTEXT-MENUS: trackrow conserva playlist abre una vez en raton y mantiene submenus',async()=>{
    const prefs=(await window.mmplayer.invoke('state')).preferences;
    try {
      await prepare();navigationRef.navigate('PlaylistDetail',{playlistId:models.playlist.id});const row=()=>document.querySelector(`.center [data-testid="track-row-${models.track.id}"]`);await until(row,'No aparece trackrow');
      let opens=0;const stop=desktopMenus.subscribe(()=>{if(desktopMenus.getSnapshot().at(-1)?.type==='track-menu')opens++;});
      const point=await input(row());await until(()=>menu('track-menu'),'No abre cancion');await wait(150);stop();position('track-menu',point);assert(opens===1,'Abre cancion varias veces');assert(desktopMenus.getSnapshot()[0].props.playlistId===models.playlist.id,'Pierde contexto playlist');assert(menu('track-menu').textContent.includes(i18n.t('actions.remove_from_playlist')),'Falta quitar de playlist');
      const add=buttons(menu('track-menu')).filter(el=>label(el)===i18n.t('actions.add_to_playlist')).at(-1);assert(add,'No aparece añadir playlist');add.click();await until(()=>menu('playlist-selector'),'No abre submenu');assert(desktopMenus.getSnapshot().length===2,'No conserva padre');assert(desktopMenus.getSnapshot()[1].parentId===desktopMenus.getSnapshot()[0].id,'Submenu sin padre');desktopMenus.clear();await wait(100);
      await input(row(),'left',450);await until(()=>menu('track-menu'),'Pulsacion larga no abre cancion');assert(desktopMenus.getSnapshot()[0].props.playlistId===models.playlist.id,'Pulsacion larga pierde playlist');
      return 'Trackrow abre una vez en el punto del raton, conserva quitar de playlist, submenu anidado y pulsacion larga';
    } finally {await restore(prefs);}
  },20000);
}
