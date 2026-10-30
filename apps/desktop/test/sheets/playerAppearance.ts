// @ts-nocheck -- Real Chromium layout, pixels, media and Electron window lifecycle.
import { database } from '../../src/renderer/ports/database';
import { player } from '../../src/renderer/player';
import { useSettingsStore } from '../../../../src/store/useSettingsStore';
import * as FileSystem from '../../src/renderer/ports/fileSystem';

export async function runPlayerAppearance(h) {
  const {test,reset,wait,until,assert}=h;
  let models=h.models, longFixture=false;
  const selectors={cover:'[data-testid="player-artwork"]',cd:'[data-testid="player-cd-artwork"]',vinyl:'[data-testid="player-vinyl-artwork"]',cassette:'[data-testid="player-cassette-artwork"]',canvas:'[data-testid="player-canvas"]'};
  const current=style=>document.querySelector('.player-panel '+selectors[style]);
  async function prepare(style) {
    await reset();
    if(!longFixture){
      // The older MP3/FLAC fixtures last 250ms. A real, longer WAV lets the
      // test observe rotation and pause without ending playback mid-assertion.
      const samples=8000*12,bytes=new Uint8Array(44+samples*2),view=new DataView(bytes.buffer);
      const text=(offset,value)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
      text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,16000,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples*2,true);
      let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
      const uri=FileSystem.cacheDirectory+'Appearance Long.wav',zip=FileSystem.cacheDirectory+'appearance-long.zip';await FileSystem.writeAsStringAsync(uri,btoa(binary),{encoding:'base64'});await window.mmplayer.invoke('fileSystem',{op:'archive',action:'zip',sources:[uri],target:zip});await window.mmplayer.invoke('importMusicZip',{uri:zip});
      const snapshot=await window.mmplayer.invoke('library'),track=snapshot.tracks.find(track=>track.title==='Appearance Long');assert(track&&track.duration>=10,'No importa WAV de duracion suficiente');models={...h.models,track:await database.get('tracks').find(track.id),album:await database.get('albums').find(track.albumId)};longFixture=true;
    }
    const originalSettings={...useSettingsStore.getState()},preferences=(await window.mmplayer.invoke('state')).preferences;
    const album=models.album,oldCover=album.coverUrl,oldCd=album.cdArtUrl,oldVideo=models.track.bgVideo;
    const image=async(name,color)=>{const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,96,96);const uri=FileSystem.cacheDirectory+'appearance-'+name+'.png';await FileSystem.writeAsStringAsync(uri,canvas.toDataURL().split(',')[1],{encoding:'base64'});return uri;};
    const cover=await image('cover','#ee2850'),cd=await image('cd','#20d050');
    await database.write(async()=>{await album.update(record=>{record.coverUrl=cover;record.cdArtUrl=cd;});await models.track.update(record=>{record.bgVideo=null;});});
    useSettingsStore.setState({playerCoverStyle:style==='canvas'?'cover':style,showPlayerVisualizer:false,showCanvas:false,showCassetteAlbumName:true,playerBackgroundStyle:'gradient',showPlayerLyrics:true});
    await window.mmplayer.invoke('preferences',{playerVisible:true,playerWidth:360,zoomFactor:1});
    const lib=await window.mmplayer.invoke('library');await player.start([lib.tracks.find(track=>track.id===models.track.id)],0,false);await wait(500);
    return async()=>{await player.pause();useSettingsStore.setState(originalSettings);await database.write(async()=>{await album.update(record=>{record.coverUrl=oldCover;record.cdArtUrl=oldCd;});await models.track.update(record=>{record.bgVideo=oldVideo;});});await window.mmplayer.invoke('preferences',preferences);await reset();};
  }
  const capture=async(style,x,y)=>{const id='appearance-'+style+'-'+Date.now();console.log('SHEET_PIXEL '+JSON.stringify({id,x,y}));await until(()=>window.__sheetPixel?.id===id,'No captura '+style);return window.__sheetPixel.rgb;};
  async function stress(style) {
    const root=current(style),panel=document.querySelector('.player-panel'),media=[...panel.querySelectorAll('img,video')];
    assert(root,'No muestra '+style);const bad=[];let frames=0,running=true;
    const check=()=>{
      frames++;if(!root.isConnected||current(style)!==root)bad.push('remontaje de '+style);
      for(const node of media)if(!node.isConnected)bad.push('imagen/video reemplazado');
      for(let node=root;node&&node!==panel;node=node.parentElement){const css=getComputedStyle(node);if(Number(css.opacity)<.99||css.display==='none'||css.visibility==='hidden')bad.push('oculto durante medida');}
      if(running)requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
    const resize=async()=>{
      const handle=panel.querySelector('.resize-handle'),rect=handle.getBoundingClientRect(),start=rect.x+rect.width/2;
      handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:start,clientY:rect.y+100,button:0}));
      for(const delta of [-20,-60,-120,-160,-80,0,40,60,10]){window.dispatchEvent(new PointerEvent('pointermove',{clientX:start+delta,clientY:rect.y+100}));await wait(25);}
      window.dispatchEvent(new PointerEvent('pointerup',{clientX:start+10,clientY:rect.y+100}));await wait(150);
    };
    try {
      for(const zoomFactor of [.7,1,1.3]){await window.mmplayer.invoke('preferences',{zoomFactor});await wait(100);await resize();}
      // Native window hide/show and a controlled AppState transition. Either
      // used to trigger Android's forced visual remount in the desktop host.
      const id='appearance-window-'+style;console.log('SHEET_WINDOW '+JSON.stringify({id}));await until(()=>window.__sheetWindowDone===id,'No vuelve la ventana');
      let state='hidden';const own=Object.getOwnPropertyDescriptor(document,'visibilityState');Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>state});
      try{document.dispatchEvent(new Event('visibilitychange'));await wait(100);state='visible';document.dispatchEvent(new Event('visibilitychange'));await wait(250);}finally{if(own)Object.defineProperty(document,'visibilityState',own);else delete document.visibilityState;}
      assert(frames>15,'No observa frames suficientes');assert(!bad.length,[...new Set(bad)].join('; '));
      return frames;
    } finally {running=false;}
  }
  for(const style of ['cover','cd','vinyl','cassette'])await test('player-appearance','APPEARANCE: '+style+' visible sin parpadeo al redimensionar y volver',async()=>{
    const restore=await prepare(style);
    try {
      await until(()=>current(style),'No renderiza '+style);await until(()=>[...current(style).querySelectorAll('img')].every(image=>image.complete&&image.naturalWidth>0),'No decodifica imagen');await wait(250);
      const root=current(style),rect=root.getBoundingClientRect();assert(rect.width>80&&rect.height>80,'Vista sin dimensiones');
      if(style==='cd'||style==='vinyl'){const mask=root.querySelector('[data-testid="player-disc-mask"]');assert(mask&&getComputedStyle(mask).maskImage.includes('radial-gradient'),'No tiene mascara web de disco');assert(root.querySelector('svg')&&root.querySelector('img'),'Faltan el disco o la imagen');}
      if(style==='cassette')assert(root.querySelector('[data-testid="player-cassette-left-reel"]')&&root.querySelector('svg'),'No dibuja casete');
      const x=style==='cd'?rect.x+rect.width*.78:style==='vinyl'?rect.x+rect.width*.58:style==='cassette'?rect.x+rect.width*.1:rect.x+rect.width*.5;
      const y=style==='cassette'?rect.y+rect.height*.375:rect.y+rect.height*.5;
      const rgb=await capture(style,x,y);assert(style==='cd'?rgb[1]>150&&rgb[0]<100:rgb[0]>150&&rgb[1]<100,'No muestra la caratula: '+rgb);
      const frames=await stress(style);
      if(style!=='cover'){await database.write(()=>models.album.update(record=>{record.coverUrl=null;record.cdArtUrl=null;}));await wait(500);assert(current(style)?.getBoundingClientRect().width>80,'No muestra alternativa sin portada');}
      return 'Pixeles reales, imagen '+(style==='cd'?'personalizada de CD':'de album')+', '+frames+' frames vigilados, tres zooms, arrastres y retorno de ventana sin remontar ni ocultar';
    } finally {await restore();}
  },25000);
  for(const style of ['cd','vinyl','cassette'])await test('player-appearance','APPEARANCE: '+style+' animacion reproduce pausa y progreso',async()=>{
    const restore=await prepare(style);
    try {
      await until(()=>current(style),'No renderiza '+style);
      const root=current(style),rotation=style==='cassette'?root.querySelector('[data-testid="player-cassette-left-reel"]'):style==='cd'?root.firstElementChild:root.querySelector('[data-testid="player-disc-mask"]').firstElementChild;
      await player.play(true);await wait(60);const first=getComputedStyle(rotation).transform;await wait(220);const second=getComputedStyle(rotation).transform;assert(first!==second,'No gira al reproducir '+JSON.stringify({first,second,playing:player.getSnapshot().playing,error:player.getSnapshot().error,duration:player.getSnapshot().duration,node:rotation.outerHTML.slice(0,500)}));await player.pause(true);await wait(100);const paused=getComputedStyle(rotation).transform;await wait(150);assert(getComputedStyle(rotation).transform===paused,'Sigue girando en pausa');
      await player.play(true);await stress(style);assert(player.getSnapshot().playing,'La ventana detiene la reproduccion');await player.pause(true);
      if(style==='cassette'){const duration=player.getSnapshot().duration;const left=root.querySelector('[data-testid="player-cassette-left-tape"]'),right=root.querySelector('[data-testid="player-cassette-right-tape"]');player.seek(duration*.1);await wait(350);const before=[left.getBoundingClientRect().width,right.getBoundingClientRect().width];player.seek(duration*.8);await wait(350);assert(left.getBoundingClientRect().width<before[0]&&right.getBoundingClientRect().width>before[1],'Las bobinas no siguen el progreso');}
      return 'Giro en reproduccion y congelacion en pausa'+(style==='cassette'?'; cinta transferida segun progreso':'');
    } finally{await restore();}
  },18000);
  await test('player-appearance','APPEARANCE: canvas estable al redimensionar y volver',async()=>{
    const restore=await prepare('canvas');let url;
    try{
      const canvas=document.createElement('canvas');canvas.width=64;canvas.height=128;const ctx=canvas.getContext('2d'),stream=canvas.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
      const done=new Promise(resolve=>{recorder.ondataavailable=event=>chunks.push(event.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));});recorder.start();for(let i=0;i<8;i++){ctx.fillStyle='#00ff00';ctx.fillRect(0,0,64,128);await wait(90);}recorder.stop();url=URL.createObjectURL(await done);stream.getTracks().forEach(track=>track.stop());
      useSettingsStore.setState({showCanvas:true});await database.write(()=>models.track.update(record=>{record.bgVideo=url;}));await until(()=>current('canvas')?.querySelector('video')?.readyState>=2,'No carga Canvas');
      const video=current('canvas').querySelector('video');let reloads=0;video.addEventListener('loadstart',()=>reloads++);video.addEventListener('emptied',()=>reloads++);
      const frames=await stress('canvas');assert(reloads===0&&video===current('canvas').querySelector('video'),'Canvas vuelve a cargar al cambiar el panel');return frames+' frames sin recrear ni recargar el video';
    }finally{await restore();if(url)URL.revokeObjectURL(url);}
  },25000);
}
