param(
    [string]$Serial,
    [ValidateSet('touch', 'rotary', 'hybrid')][string]$InputMode = 'touch'
)
$ErrorActionPreference = 'Stop'
$taskSdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$taskAdbPath = Join-Path $taskSdkPath 'platform-tools\adb.exe'
$taskDhuPath = Join-Path $taskSdkPath 'extras\google\auto\desktop-head-unit.exe'
if (!(Test-Path -LiteralPath $taskDhuPath)) { throw 'Instala Android Auto Desktop Head Unit Emulator desde SDK Manager.' }
if (!(Test-Path -LiteralPath $taskAdbPath)) { throw 'No se encuentra ADB en el SDK de Android.' }
$taskDevices = @(& $taskAdbPath devices | Select-String '^([^\s]+)\s+device$' | ForEach-Object { $_.Matches[0].Groups[1].Value })
if (!$Serial) {
    if ($taskDevices.Count -ne 1) { throw 'Conecta y autoriza un móvil, o indica -Serial si hay varios dispositivos.' }
    $Serial = $taskDevices[0]
}
if ($Serial -notin $taskDevices) { throw 'El dispositivo no está conectado o no ha autorizado la depuración USB.' }
Write-Host 'Activa el servidor de unidad principal en las opciones de desarrollador de Android Auto del móvil.'
& $taskAdbPath -s $Serial forward tcp:5277 tcp:5277
if ($LASTEXITCODE -ne 0) { throw 'No se ha podido conectar con ADB.' }
Push-Location (Split-Path $taskDhuPath)
try { & $taskDhuPath "--input=$InputMode" } finally {
    Pop-Location
    & $taskAdbPath -s $Serial forward --remove tcp:5277
}
