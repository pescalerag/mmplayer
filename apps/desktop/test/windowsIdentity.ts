import { app, shell, BrowserWindow } from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { registerWindowsIdentity } from '../src/main/windowsIdentity';

// Run in Electron: exercise the real .lnk property store and Windows app catalog.
const id = 'com.pescalerag.mmplayer.desktop.IdentityTest';
const name = 'MMPlayer Identity Test';
app.setAppUserModelId(id);
app.whenReady().then(async () => {
  const directory = await mkdtemp(resolve('../../.tmp/windows-identity-'));
  const shortcut = join(app.getPath('appData'), 'Microsoft/Windows/Start Menu/Programs', `${name}.lnk`);
  let window: BrowserWindow | undefined;
  try {
    const icon = await registerWindowsIdentity({ appId: id, name, directory, iconPath: resolve('build/icon.png') });
    const link = shell.readShortcutLink(shortcut);
    assert.equal(link.appUserModelId, id);
    assert.equal(link.target.toLowerCase(), process.execPath.toLowerCase());
    assert.equal(link.icon, icon);
    assert.equal(link.args, `"${app.getAppPath()}"`);
    const image = await readFile(icon!);
    assert.equal(image.readUInt32LE(18), 22);
    assert.equal(image.readUInt32LE(14), image.length - 22);
    // Re-registration must preserve a valid shortcut (and repair stale paths).
    shell.writeShortcutLink(shortcut, 'update', { target: link.target, args: 'stale' });
    await registerWindowsIdentity({ appId: id, name, directory, iconPath: resolve('build/icon.png') });
    assert.equal(shell.readShortcutLink(shortcut).args, link.args);
    window = new BrowserWindow({ show: false, webPreferences: { autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false } });
    window.setAppDetails({ appId: id, appIconPath: icon!, relaunchDisplayName: name });
    await window.loadURL('data:text/html,<title>MMPlayer identity integration</title>');
    await window.webContents.executeJavaScript(`(async () => {
      const rate = 8000, samples = rate * 12, wav = new ArrayBuffer(44 + samples * 2), view = new DataView(wav);
      const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
      text(0,'RIFF');view.setUint32(4, wav.byteLength - 8, true);text(8,'WAVEfmt ');view.setUint32(16,16,true);
      view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);view.setUint32(28,rate*2,true);
      view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples*2,true);
      for(let i=0;i<samples;i++)view.setInt16(44+i*2,Math.sin(i*2*Math.PI*440/rate)*20,true);
      window.audio = new Audio(URL.createObjectURL(new Blob([wav],{type:'audio/wav'})));audio.loop=true;
      navigator.mediaSession.metadata=new MediaMetadata({title:'MMPlayer identity integration',artist:'MMPlayer test'});
      navigator.mediaSession.setActionHandler('play',()=>{audio.play();navigator.mediaSession.playbackState='playing'});
      navigator.mediaSession.setActionHandler('pause',()=>{audio.pause();navigator.mediaSession.playbackState='paused'});
      await audio.play();navigator.mediaSession.playbackState='playing';
    })()`);
    const { stdout } = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `
      $ErrorActionPreference = 'Stop'
      Add-Type -AssemblyName System.Runtime.WindowsRuntime
      function Await($operation, $resultType) {
        $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\u00601' } | Select-Object -First 1
        $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))
        if (!$task.Wait(5000)) { throw 'Windows media query timed out' }
        $task.Result
      }
      $managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType=WindowsRuntime]
      $manager = Await ($managerType::RequestAsync()) $managerType
      $session = $null
      for ($i = 0; $i -lt 30; $i++) {
        $session = $manager.GetSessions() | Where-Object SourceAppUserModelId -eq '${id}' | Select-Object -First 1
        if ($session) { break }
        Start-Sleep -Milliseconds 200
      }
      if (!$session) { throw 'Windows did not recognize the playing media session' }
      $propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType=WindowsRuntime]
      $properties = Await ($session.TryGetMediaPropertiesAsync()) $propertiesType
      if ($properties.Title -ne 'MMPlayer identity integration' -or $properties.Artist -ne 'MMPlayer test') { throw 'Incorrect Windows metadata' }
      if (!(Await ($session.TryPauseAsync()) ([bool]))) { throw 'Windows pause was rejected' }
      Start-Sleep -Milliseconds 300
      if ($session.GetPlaybackInfo().PlaybackStatus.ToString() -ne 'Paused') { throw 'Windows pause did not reach the player' }
      if (!(Await ($session.TryPlayAsync()) ([bool]))) { throw 'Windows play was rejected' }
      Start-Sleep -Milliseconds 300
      if ($session.GetPlaybackInfo().PlaybackStatus.ToString() -ne 'Playing') { throw 'Windows play did not reach the player' }
      $shell = New-Object -ComObject Shell.Application
      $item = $null
      for ($i = 0; $i -lt 30; $i++) {
        $item = $shell.NameSpace('shell:AppsFolder').ParseName('${id}')
        if ($item -and $item.Name -eq '${name}') { break }
        Start-Sleep -Milliseconds 200
      }
      if (!$item -or $item.Name -ne '${name}') { throw 'Windows cannot resolve the application name' }
      $item.Name
    `], { windowsHide: true, timeout: 15000 });
    assert.equal(stdout.trim(), name);
    console.log('WINDOWS_IDENTITY OK: Windows resolves the media source name; real SMTC metadata/play/pause, shortcut, icon and repair verified');
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    window?.destroy();
    await rm(shortcut, { force: true });
    await rm(directory, { recursive: true, force: true });
  }
  app.exit(Number(process.exitCode ?? 0));
});
