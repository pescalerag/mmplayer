// @ts-nocheck -- Visual layout against the actual Electron window and Chromium DOM.
import { database } from '../../src/renderer/ports/database';
import { player } from '../../src/renderer/player';

export async function runLyricsLayout({test,reset,wait,until,assert,models}) {
  for (const synced of [true,false]) await test('lyrics-layout',`LYRICS-LAYOUT: ${synced?'sincronizadas':'texto'} resoluciones y zoom`,async()=>{
    const preferences=(await window.mmplayer.invoke('state')).preferences;
    const original=models.track.lyricsLRC;
    const lines=['Una frase para comprobar el margen izquierdo','Una frase larga que debe adaptarse al ancho disponible de la pantalla sin quedar cortada por los bordes del panel','Última frase de prueba'];
    try {
      await reset();
      await database.write(()=>models.track.update(track=>{track.lyricsLRC=lines.map((line,i)=>(synced?`[00:0${i}.00]`:'')+line).join('\n');}));
      const lib=await window.mmplayer.invoke('library');await player.start([lib.tracks.find(t=>t.id===models.track.id)],0,false);
      await window.mmplayer.invoke('preferences',{playerVisible:false});
      document.querySelector('[data-testid="desktop-toggle-lyrics"]').click();
      const selector=`[data-testid="lyrics-${synced?'synced':'plain'}-list"]`;
      await until(()=>document.querySelector(selector),'No abre letras de prueba');
      const checked=[];
      for(const [width,height] of [[900,640],[1280,800],[1920,1080]]) {
        const id=`lyrics-size-${width}-${synced}`;console.log('SHEET_SIZE '+JSON.stringify({id,width,height}));await until(()=>window.__sheetSizeDone===id,'No cambia resolucion');
        for(const zoomFactor of [.7,1,1.3]) {
          await window.mmplayer.invoke('preferences',{zoomFactor});await wait(250);
          const list=document.querySelector(selector),bounds=list.getBoundingClientRect();
          const content=list.firstElementChild,style=getComputedStyle(content);
          assert(parseFloat(style.paddingLeft)===48,'Margen izquierdo incorrecto: '+style.paddingLeft);
          assert(parseFloat(style.paddingRight)===28,'Margen derecho incorrecto');
          assert(list.scrollWidth<=list.clientWidth+1,'Desbordamiento horizontal');
          const texts=[...list.querySelectorAll('[dir="auto"]')].filter(el=>lines.some(line=>el.textContent.includes(line))&&!el.querySelector('[dir="auto"]'));
          assert(texts.length>0,'No aparecen las letras');
          for(const text of texts){const r=text.getBoundingClientRect();assert(r.left>=bounds.left+47&&r.right<=bounds.right-27,'Texto fuera de los margenes');assert(text.scrollWidth<=text.clientWidth+1,'Frase cortada horizontalmente');assert(getComputedStyle(text).visibility!=='hidden'&&getComputedStyle(text).opacity!=='0','Texto oculto');}
          checked.push(`${width}x${height}@${zoomFactor}`);
          if((width===900&&zoomFactor===1.3)||(width===1920&&zoomFactor===1)){
            const id=`lyrics-${synced?'synced':'plain'}-${width}-${zoomFactor}`;console.log('SHEET_PIXEL '+JSON.stringify({id,x:Math.round(bounds.left+10),y:Math.round(bounds.top+10)}));await until(()=>window.__sheetPixel?.id===id,'No captura letras');
          }
        }
      }
      return 'Margen izquierdo 48px, derecho 28px, texto visible y sin desbordamiento: '+checked.join(', ');
    } finally {
      await reset();await database.write(()=>models.track.update(track=>{track.lyricsLRC=original;}));
      const id='lyrics-restore-'+synced;console.log('SHEET_SIZE '+JSON.stringify({id,restore:true}));await until(()=>window.__sheetSizeDone===id,'No restaura ventana');await window.mmplayer.invoke('preferences',preferences);
    }
  },25000);
}
