// @ts-nocheck -- Actual shared settings, real audio and a test-only local Discord IPC server.
import { useSettingsStore } from '../../../../src/store/useSettingsStore';
import { navigationRef } from '../../src/renderer/ports/navigationRef';
import { player } from '../../src/renderer/player';
import { database } from '../../src/renderer/ports/database';
export async function runDiscordPresence({test,reset,wait,until,assert}) {
  await test('discord-presence','DISCORD: ajustes otros desactivado persistencia cancion pausa y desconexion',async()=>{
    const original=useSettingsStore.getState().discordRichPresenceEnabled;
    const originalFetch=window.fetch;let album,oldTitle,oldCover;
    try {
      await reset();assert(original===false,'No esta desactivado por defecto');assert(!window.__sheetDiscordConnected,'Conecta sin consentimiento');
      document.querySelectorAll('.sidebar nav button')[5].click();await until(()=>document.querySelector('[data-testid="settings-other"]'),'No aparece Otros');document.querySelector('[data-testid="settings-other"]').click();
      await until(()=>document.querySelector('[data-testid="discord-presence-toggle"]'),'No abre Otros');
      const toggle=()=>{const root=document.querySelector('[data-testid="discord-presence-toggle"]');return root?.matches('input')?root:root?.querySelector('input');};assert(toggle().checked===false,'Interruptor no desactivado');toggle().click();
      await until(()=>window.__sheetDiscordConnected,'No conecta RPC al activar');assert(useSettingsStore.getState().discordRichPresenceEnabled,'No activa preferencia');await wait(150);await useSettingsStore.persist.rehydrate();assert(useSettingsStore.getState().discordRichPresenceEnabled,'No persiste preferencia');
      console.log('SHEET_DISCORD_FIXTURE');await until(()=>window.__sheetDiscordFixture,'No crea audio de prueba');await window.mmplayer.invoke('pickMusic',{folders:true});const lib=await window.mmplayer.invoke('library'),track=lib.tracks.find(t=>t.title==='Discord integration');assert(track,'No importa audio');
      album=await database.get('albums').find(track.albumId);oldTitle=album.storedTitle;oldCover=album.coverUrl;
      await database.write(()=>album.update(a=>{a.storedTitle='Discord Integration Original Soundtrack';a.coverUrl=null;}));
      const artwork='https://cdn-images.dzcdn.net/images/cover/7f6ebbadc0069683454032356c88873e/1000x1000-000000-80-0-0.jpg';
      window.fetch=async(...args)=>{
        if(decodeURIComponent(String(args[0])).includes('api.deezer.com/search/album')&&decodeURIComponent(String(args[0])).includes('Discord Integration'))return new Response(JSON.stringify({data:[
          {title:'Discord Integration II: Original Soundtrack',artist:{name:track.artist},cover_xl:'https://example.com/wrong-sequel.jpg'},
          {title:'Discord Integration: Original Soundtrack',artist:{name:track.artist},cover_xl:artwork},
        ]}),{status:200,headers:{'Content-Type':'application/json'}});
        return originalFetch(...args);
      };
      window.__sheetDiscordActivities=[];await player.start([track],0,true);await until(()=>window.__sheetDiscordActivities.some(a=>a?.details===track.title),'No publica cancion');
      const activity=window.__sheetDiscordActivities.find(a=>a?.details===track.title);assert(activity.type===2&&activity.name&&activity.state,'No publica Escuchando y artistas');assert(activity.assets.large_url==='https://mmplayer.pescalerag.com','Enlace de caratula incorrecto');
      await until(()=>window.__sheetDiscordActivities.some(a=>a?.assets?.large_image===artwork),'No envia caratula resuelta con puntuacion distinta');
      const imageActivity=window.__sheetDiscordActivities.find(a=>a?.assets?.large_image===artwork);assert(imageActivity.assets.large_url==='https://mmplayer.pescalerag.com'&&imageActivity.details_url===imageActivity.assets.large_url&&imageActivity.state_url===imageActivity.assets.large_url,'No envia los enlaces junto a la imagen real');
      player.pause();await until(()=>window.__sheetDiscordActivities.at(-1)===null,'Pausa no retira actividad');
      navigationRef.navigate('SettingsOther');await until(()=>toggle(),'No vuelve a Otros');toggle().click();await until(()=>!useSettingsStore.getState().discordRichPresenceEnabled,'No desactiva');await wait(150);await useSettingsStore.persist.rehydrate();assert(!useSettingsStore.getState().discordRichPresenceEnabled,'No persiste desactivacion');
      return 'Otros compartido, persistencia, audio real y pausa; caratula publica resuelta pese a diferencias de puntuacion, sin confundir secuelas, y enlaces de imagen/titulo/artistas recibidos por IPC; servidor Discord aislado';
    } finally {window.fetch=originalFetch;useSettingsStore.getState().setDiscordRichPresenceEnabled(original);player.pause();if(album)await database.write(()=>album.update(a=>{a.storedTitle=oldTitle;a.coverUrl=oldCover;}));await reset();}
  },20000);
}
