// @ts-nocheck -- Long real queues, actual Chromium scrolling and held native mouse input.
import { player } from '../../src/renderer/player';
import { QueueActionsService } from '../../../../src/services/QueueActionsService';
import { refreshQueueSnapshot, useQueueSnapshotStore } from '../../../../src/store/useQueueSnapshotStore';
export async function runQueueVirtualization({test,reset,wait,until,assert}) {
  await test('queue','QUEUE-OPEN-SCROLL: scroll inmediato al aparecer las primeras filas',async()=>{
    const prefs=(await window.mmplayer.invoke('state')).preferences;
    let observer;
    try {
      await reset();const lib=await window.mmplayer.invoke('library');await player.start(Array.from({length:700},(_,i)=>lib.tracks[i%lib.tracks.length]),0,false);
      for(const zoomFactor of [.7,1,1.3]){
        await reset();await window.mmplayer.invoke('preferences',{zoomFactor,playerVisible:true});useQueueSnapshotStore.setState({queue:[],activeIndex:-1,ready:false});
        let scroll,triggered=false,initial;
        observer=new MutationObserver(()=>{
          const root=document.querySelector('[data-testid="desktop-queue-sheet"] [data-desktop-draggable-list]');
          if(!root||!root.querySelector('[data-desktop-drag-index]')||triggered)return;
          scroll=[...root.querySelectorAll('*')].find(el=>['auto','scroll'].includes(getComputedStyle(el).overflowY));if(!scroll||scroll.clientHeight<=0)return;
          triggered=true;initial={height:scroll.scrollHeight,viewport:scroll.clientHeight,count:root.querySelectorAll('[data-desktop-drag-index]').length};scroll.scrollTop=72*80;
        });observer.observe(document.body,{childList:true,subtree:true});document.querySelector('[data-testid="desktop-open-queue"]').click();await until(()=>triggered,'No provoca scroll temprano');observer.disconnect();
        const visible=()=>{const b=scroll.getBoundingClientRect();return [...scroll.querySelectorAll('[data-desktop-drag-index]')].filter(el=>{const r=el.getBoundingClientRect();return r.bottom>b.top+1&&r.top<b.bottom-1;});};
        await until(()=>visible().length>0,'Cola negra tras scroll inicial '+JSON.stringify({zoomFactor,initial,offset:scroll.scrollTop}));
        for(const offset of [72*200,72*30,72*500,0]){scroll.scrollTop=offset;await wait(120);await until(()=>visible().length>0,'Hueco negro al desplazar rapido '+zoomFactor+' '+offset);}
      }
      return 'Abrir desde snapshot vacio y desplazar al primer lote, saltos rapidos y vuelta al inicio: filas visibles a zoom70/100/130%';
    } finally {observer?.disconnect();await window.mmplayer.invoke('preferences',prefs);await reset();}
  },26000);
  await test('queue','QUEUE-VIRTUAL: lotes de ocho ventana acotada drag autoscroll cancelar y soltar una vez',async()=>{
    const prefs=(await window.mmplayer.invoke('state')).preferences,originalMove=QueueActionsService.move;
    let mutations=0,holding=false,lastPoint={x:0,y:0};let observer;
    const pointer=async(phase,x,y)=>{lastPoint={x,y};const id='queue-pointer-'+Date.now();console.log('SHEET_POINTER '+JSON.stringify({id,phase,x:Math.round(x),y:Math.round(y)}));await until(()=>window.__sheetPointerDone===id,'No llega movimiento de raton');holding=phase!=='up';};
    const root=()=>document.querySelector('[data-testid="desktop-queue-sheet"] [data-desktop-draggable-list]');
    const rows=()=>[...root().querySelectorAll('[data-desktop-drag-index]')];
    const scroller=()=>[...root().querySelectorAll('*')].find(el=>getComputedStyle(el).overflowY==='auto'||getComputedStyle(el).overflowY==='scroll');
    const snapshot=()=>player.getQueueTracks().map(t=>t.id);
    try {
      await reset();await window.mmplayer.invoke('preferences',{zoomFactor:1,playerVisible:true});
      const lib=await window.mmplayer.invoke('library');await player.start(Array.from({length:600},(_,i)=>lib.tracks[i%lib.tracks.length]),0,false);
      await refreshQueueSnapshot();
      const batches=[];observer=new MutationObserver(()=>{const current=root()?.querySelectorAll('[data-desktop-drag-index]').length||0;if(current&&batches.at(-1)!==current)batches.push(current);});observer.observe(document.body,{childList:true,subtree:true});
      document.querySelector('[data-testid="desktop-open-queue"]').click();await until(()=>root()&&rows().length>0,'No abre cola larga');await wait(250);observer.disconnect();
      assert(batches[0]===8,'No comienza por lote de ocho: '+batches);assert(rows().length<100,'Monta toda la cola: '+rows().length);const scroll=scroller();assert(scroll,'No hay scroll virtualizado');
      const play=rows()[0].querySelector('[data-testid^="queue-play-"]'),movedId=play.dataset.testid.slice('queue-play-'.length),initial=snapshot();
      QueueActionsService.move=(...args)=>{mutations++;return originalMove(...args);};
      const row=rows()[0].getBoundingClientRect(),bounds=scroll.getBoundingClientRect();
      const handle=rows()[0].querySelector('[data-testid^="queue-drag-"]').getBoundingClientRect();await pointer('down',handle.left+handle.width/2,handle.top+handle.height/2);await wait(180);await until(()=>root().dataset.dragging==='true','Pulsacion mantenida no inicia drag');
      await pointer('move',row.left+25,bounds.bottom-2);await wait(1200);
      assert(scroll.scrollTop>100,'No hace autoscroll hacia abajo');assert(mutations===0&&JSON.stringify(snapshot())===JSON.stringify(initial),'Guarda orden durante el arrastre');assert(rows().length<100,'Desactiva virtualizacion al arrastrar');
      await pointer('up',lastPoint.x,lastPoint.y);await until(()=>mutations===1,'No confirma exactamente una vez');await until(()=>snapshot().indexOf(movedId)>2,'No mueve mas alla de primeras filas');await wait(100);assert(mutations===1,'Confirma mas de una vez');
      const committed=snapshot();scroll.scrollTop=72*250;await wait(400);await until(()=>rows().some(el=>Number(el.dataset.desktopDragIndex)>240),'No carga un lote lejano');assert(rows().length<100,'Acumula todas las filas al desplazarse');
      const s=scroll.getBoundingClientRect(),candidate=rows().find(el=>{const r=el.getBoundingClientRect();return r.top>=s.top&&r.bottom<=s.bottom;});assert(candidate,'No hay fila visible para arrastrar arriba');const r=candidate.getBoundingClientRect(),before=scroll.scrollTop;
      const secondHandle=candidate.querySelector('[data-testid^="queue-drag-"]').getBoundingClientRect();await pointer('down',secondHandle.left+secondHandle.width/2,secondHandle.top+secondHandle.height/2);await wait(150);await until(()=>root().dataset.dragging==='true','No inicia segundo drag');await pointer('move',r.left+25,s.top+2);await wait(900);assert(scroll.scrollTop<before-100,'No hace autoscroll hacia arriba');
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));await pointer('up',lastPoint.x,lastPoint.y);await wait(100);assert(mutations===1&&JSON.stringify(snapshot())===JSON.stringify(committed),'Escape guarda movimiento cancelado');const stopped=scroll.scrollTop;await wait(150);assert(Math.abs(stopped-scroll.scrollTop)<2,'Sigue autoscroll despues de cancelar');
      scroll.scrollTop=scroll.scrollHeight;await wait(400);await until(()=>rows().some(el=>Number(el.dataset.desktopDragIndex)===598),'No permite llegar al final');assert(rows().length<100,'Monta toda cola al llegar al final');
      const finalHandle=rows().find(el=>Number(el.dataset.desktopDragIndex)===598).querySelector('[data-testid^="queue-drag-"]').getBoundingClientRect();await pointer('down',finalHandle.left+finalHandle.width/2,finalHandle.top+finalHandle.height/2);await wait(150);await until(()=>root().dataset.dragging==='true','No inicia drag final');await player.start(lib.tracks,0,false);await until(()=>root().dataset.dragging==='false','Cambiar cola no cancela drag');await pointer('up',lastPoint.x,lastPoint.y);assert(mutations===1,'Guarda arrastre de una cola reemplazada');
      return '600 canciones: primer lote '+batches[0]+', menos de100 filas montadas; autoscroll real arriba/abajo, cambio confirmado una vez al soltar, Escape y cambio de cola cancelan, acceso al ultimo lote';
    } finally {observer?.disconnect();if(holding)await pointer('up',lastPoint.x,lastPoint.y);QueueActionsService.move=originalMove;await player.pause();await window.mmplayer.invoke('preferences',prefs);await reset();}
  },24000);
}
