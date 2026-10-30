const { app, clipboard, ClipboardItem, dialog, nativeImage } = require('electron');
const { writeFile, appendFile, readFile, mkdir, copyFile, rename } = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { join } = require('node:path');
const output = process.env.MMPLAYER_SHEET_AUDIT_OUTPUT;
// Isolate Rich Presence tests from the user's real Discord client.
const discordPipe=process.platform==='win32'?`\\\\.\\pipe\\mmplayer-discord-sheet-${process.pid}`:join(output,'discord-test.sock');
process.env.MMPLAYER_DISCORD_TEST_PIPE=discordPipe;
const discordTestServer=require('node:net').createServer(socket=>{
  let buffer=Buffer.alloc(0);
  const frame=(value)=>{const body=Buffer.from(JSON.stringify(value)),head=Buffer.alloc(8);head.writeUInt32LE(1);head.writeUInt32LE(body.length,4);return Buffer.concat([head,body]);};
  socket.on('error',()=>{});socket.on('data',chunk=>{
    buffer=Buffer.concat([buffer,chunk]);
    while(buffer.length>=8){const op=buffer.readUInt32LE(),size=buffer.readUInt32LE(4);if(buffer.length<size+8)return;const data=JSON.parse(buffer.subarray(8,size+8).toString());buffer=buffer.subarray(size+8);
      if(op===0){socket.write(frame({evt:'READY'}));void win.webContents.executeJavaScript('window.__sheetDiscordConnected=true');}
      else if(op===1){socket.write(frame({nonce:data.nonce,cmd:'SET_ACTIVITY',data:{}}));void win.webContents.executeJavaScript(`(window.__sheetDiscordActivities??=[]).push(${JSON.stringify(data.args.activity)})`);}
    }
  });
});
discordTestServer.listen(discordPipe);
// Test-only destination: exercise the actual save/copy path without OS dialog automation.
dialog.showSaveDialog = async (_window, options) => {
  const cancel = await win.webContents.executeJavaScript('!!window.__sheetCancelNextSave');
  if (cancel) { await win.webContents.executeJavaScript('window.__sheetCancelNextSave=false;window.__sheetSaveCancelled=true'); return { canceled: true }; }
  const filePath = join(output, options.defaultPath);
  await win.webContents.executeJavaScript(`window.__sheetLastSavedFile=${JSON.stringify(filePath)}`);
  return { canceled: false, filePath };
};
let win;
let originalClipboard;
async function restoreClipboard() {
  if(!originalClipboard)return;
  try {
    const items=await originalClipboard;
    const copies=await Promise.all(items.filter(item=>item.types.length).map(async item=>new ClipboardItem(Object.fromEntries(await Promise.all(item.types.map(async type=>[type,await item.getType(type)]))))));
    if(copies.length) await clipboard.write(copies); else clipboard.clear();
  }catch(error){console.error('SHEET_AUDIT clipboard restore:',String(error));}
}
app.on('browser-window-created', (_, window) => {
  if (window.webContents.isOffscreen()) return;
  win = window;
  originalClipboard = clipboard.read();
  window.webContents.setAudioMuted(true);
  window.webContents.setBackgroundThrottling(false);
  window.webContents.on('console-message', (...args) => {
    const message = typeof args[1] === 'object' ? args[1].message : args[2];
    if (message?.startsWith('SHEET_AUDIT')) console.log(message);
    if(message==='SHEET_DISCORD_FIXTURE')void(async()=>{
      const folder=join(output,'discord-music');await mkdir(folder,{recursive:true});
      const samples=8000*12,wav=Buffer.alloc(44+samples*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVE',8);wav.write('fmt ',12);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples*2,40);await writeFile(join(folder,'Discord integration.wav'),wav);
      const original=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=original;return {canceled:false,filePaths:[folder]};};await win.webContents.executeJavaScript('window.__sheetDiscordFixture=true');
    })();
    if (message?.startsWith('SHEET_MISSING ')) {
      const {id,op}=JSON.parse(message.slice(14));
      void (async()=>{
        const folder=join(output,'missing-folder-fixture'),away=join(output,'missing-folder-away');
        if(op==='create'){await mkdir(folder,{recursive:true});await copyFile(join(output,'music','Sheet audit.mp3'),join(folder,'Missing folder song.mp3'));const original=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=original;return {canceled:false,filePaths:[folder]};};}
        else if(op==='remove')await rename(folder,away);
        else if(op==='restore')await rename(away,folder);
        await window.webContents.executeJavaScript(`window.__sheetMissing=${JSON.stringify({id,path:folder,uri:pathToFileURL(folder).href})}`);
      })();
    }
    if (message?.startsWith('SHEET_AUDIT {')) {
      const row=JSON.parse(message.slice(12));
      if(row.status==='fail') void window.webContents.capturePage().then(image=>writeFile(join(output,`${row.sheet}-${row.option.replace(/[^a-z0-9]/gi,'_')}.png`),image.toPNG()));
    }
    if (message?.startsWith('SHEET_IMAGE ')) {
      const {id,path}=JSON.parse(message.slice(12));
      void readFile(path).then(bytes=>{
        const png=nativeImage.createFromBuffer(bytes),size=png.getSize(),bitmap=png.toBitmap();
        let bright=0,opaque=0,white=0,bottomBright=0;const colors=new Set();
        for(let y=0;y<size.height;y+=8)for(let x=0;x<size.width;x+=8){const offset=(y*size.width+x)*4;colors.add(bitmap.subarray(offset,offset+3).toString('hex'));if(bitmap[offset+3]>240)opaque++;if(bitmap[offset]>180&&bitmap[offset+1]>180&&bitmap[offset+2]>180)bright++;if(bitmap[offset]>245&&bitmap[offset+1]>245&&bitmap[offset+2]>245)white++;if(y>size.height*.8&&bitmap[offset]>180&&bitmap[offset+1]>180&&bitmap[offset+2]>180)bottomBright++;}
        return window.webContents.executeJavaScript(`window.__sheetImage=${JSON.stringify({id,...size,bright,opaque,white,bottomBright,colors:colors.size,bytes:bytes.length})}`);
      });
    }
    if (message?.startsWith('SHEET_WINDOW ')) {
      const { id } = JSON.parse(message.slice(13));
      window.blur();
      window.hide();
      setTimeout(() => {
        window.show(); window.focus();
        setTimeout(() => window.webContents.executeJavaScript(`window.__sheetWindowDone=${JSON.stringify(id)}`), 180);
      }, 250);
    }
    if (message?.startsWith('SHEET_SIZE ')) {
      const { id, width, height, restore } = JSON.parse(message.slice(11));
      if (!window.__auditOriginalBounds) window.__auditOriginalBounds = { bounds: window.getBounds(), maximized: window.isMaximized() };
      if (restore) {
        window.setBounds(window.__auditOriginalBounds.bounds);
        if (window.__auditOriginalBounds.maximized) window.maximize();
      } else { window.unmaximize(); window.setSize(width, height); }
      setTimeout(() => window.webContents.executeJavaScript(`window.__sheetSizeDone=${JSON.stringify(id)}`), 220);
    }
    if (message?.startsWith('SHEET_INPUT ')) {
      const {id,x,y,hold=0,button='left'}=JSON.parse(message.slice(12));
      window.show(); window.focus();
      window.webContents.sendInputEvent({type:'mouseMove',x,y});
      window.webContents.sendInputEvent({type:'mouseDown',x,y,button,clickCount:1});
      setTimeout(()=>{window.webContents.sendInputEvent({type:'mouseUp',x,y,button,clickCount:1});
      setTimeout(()=>window.webContents.executeJavaScript(`window.__sheetInputDone=${JSON.stringify(id)}`),100);},hold);
    }
    if(message?.startsWith('SHEET_POINTER ')) {
      const {id,phase,x,y}=JSON.parse(message.slice(14));window.show();window.focus();
      if(phase==='down'){window.webContents.sendInputEvent({type:'mouseMove',x,y});window.webContents.sendInputEvent({type:'mouseDown',x,y,button:'left',clickCount:1});}
      else if(phase==='move')window.webContents.sendInputEvent({type:'mouseMove',x,y});
      else window.webContents.sendInputEvent({type:'mouseUp',x,y,button:'left',clickCount:1});
      setTimeout(()=>window.webContents.executeJavaScript(`window.__sheetPointerDone=${JSON.stringify(id)}`),80);
    }
    if(message?.startsWith('SHEET_PIXEL ')) {
      const {id,x,y}=JSON.parse(message.slice(12));
      void (async()=>{
        window.show();window.focus();
        const viewport=await window.webContents.executeJavaScript('({width:innerWidth,height:innerHeight})');
        const image=await window.webContents.capturePage();const size=image.getSize(),bytes=image.toBitmap();
        const offset=(Math.floor(y*size.height/viewport.height)*size.width+Math.floor(x*size.width/viewport.width))*4;
        await writeFile(join(output,'canvas-'+id+'.png'),image.toPNG());
        const rgb=[bytes[offset+2],bytes[offset+1],bytes[offset]];
        await window.webContents.executeJavaScript(`window.__sheetPixel=${JSON.stringify({id,rgb})}`);
      })();
    }
    if(message?.startsWith('SHEET_CLIPBOARD ')) {
      const id=message.slice(16);
      void clipboard.readText().then(value=>window.webContents.executeJavaScript(`window.__sheetClipboard={id:${JSON.stringify(id)},value:${JSON.stringify(value)}}`));
    }
    void appendFile(join(output, 'console.log'), String(message) + '\n');
  });
  window.webContents.on('render-process-gone', (_, details) => { console.error('SHEET_AUDIT renderer gone', details); void writeFile(join(output,'crash.json'),JSON.stringify(details)); app.exit(1); });
  window.webContents.once('did-finish-load', async () => {
    try {
      const report = await window.webContents.executeJavaScript(`(async () => {
        window.__sheetSaveDirectory=${JSON.stringify(output)};
        window.__sheetCaseFilter=${JSON.stringify(process.env.MMPLAYER_SHEET_AUDIT_FILTER || '')};
        window.__sheetExpectedTypes=${process.env.MMPLAYER_SHEET_AUDIT_TYPES || '[]'};
        for(let i=0;i<200;i++) {
          if(window.__runSheetAudit && document.querySelector('[data-testid="mobile-screen-Home"]')) break;
          await new Promise(r=>setTimeout(r,100));
        }
        return await window.__runSheetAudit();
      })()`, true);
      await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2));
      await writeFile(join(output, 'interactions.json'), JSON.stringify(report.interactions || [], null, 2));
      const lines = ['# Auditoría de sheets de MMPlayer PC', '', report.scope, '', '| Sheet | Opción | Resultado | Evidencia |', '|---|---|---|---|'];
      for(const row of report.results) lines.push(`| ${row.sheet} | ${row.option.replaceAll('|','/')} | ${row.status} | ${row.detail.replaceAll('|','/').replaceAll('\n',' ')} |`);
      await writeFile(join(output, 'report.md'), lines.join('\n'));
      await writeFile(join(output, 'final.png'), (await window.webContents.capturePage()).toPNG());
      console.log('SHEET_AUDIT SUMMARY', JSON.stringify(report.summary));
      await restoreClipboard();
      app.exit(report.summary.fail ? 1 : 0);
    } catch (error) {
      await writeFile(join(output, 'fatal.txt'), String(error.stack || error));
      if (win && !win.isDestroyed()) await writeFile(join(output, 'failure.png'), (await win.webContents.capturePage()).toPNG());
      await restoreClipboard();
      console.error(error); app.exit(1);
    }
  });
});
require('../../build/main.cjs');
