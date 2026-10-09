# Chat On Steroids fork updater — 2.1.39
param([ValidatePattern('^\d+\.\d+\.\d+$')][string]$TargetVersion = '2.1.39')

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

Write-Host "Actualizando a ${TargetVersion}:"
$repo = 'Gokuencinar/chat-on-steroids'
$api = "https://api.github.com/repos/$repo/releases/tags/v$TargetVersion"
$installerName = 'Chat-On-Steroids-Setup-x64.exe'
$checksumName = 'SHA256SUMS.txt'
$headers = @{
  'Accept' = 'application/vnd.github+json'
  'User-Agent' = 'Chat-On-Steroids-double-click-updater'
}

function Write-Step([string]$text) {
  Write-Host
  Write-Host "==> $text" -ForegroundColor Cyan
}

function Get-AppProcesses {
  @(Get-Process -Name 'Chat On Steroids' -ErrorAction SilentlyContinue)
}

function Get-InstalledApp {
  $roots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  $entry = Get-ItemProperty $roots -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -eq 'Chat On Steroids' } |
    Sort-Object { if ($_.PSPath -like 'HKCU:*') { 0 } else { 1 } } |
    Select-Object -First 1

  $uninstaller = $null
  if ($entry -and $entry.UninstallString -match '^\s*"([^"]+)"') {
    $uninstaller = $Matches[1]
  } elseif ($entry -and $entry.UninstallString) {
    $uninstaller = ($entry.UninstallString -split '\s+/currentuser|\s+/S')[0].Trim('" ')
  }

  $installDir = if ($uninstaller) { Split-Path -Parent $uninstaller } else {
    Join-Path $env:LOCALAPPDATA 'Programs\Chat On Steroids'
  }
  $exe = Join-Path $installDir 'Chat On Steroids.exe'
  $version = if ($entry -and $entry.DisplayVersion) { [string]$entry.DisplayVersion } else { $null }

  if (-not $version -and (Test-Path -LiteralPath $exe)) {
    try {
      $version = [Diagnostics.FileVersionInfo]::GetVersionInfo($exe).ProductVersion
    } catch {
      $version = $null
    }
  }

  [pscustomobject]@{
    Version = $version
    InstallDir = $installDir
    Exe = $exe
  }
}

function Read-ExtensionVersion {
  $manifest = Join-Path $env:APPDATA 'chat-on-steroids\extension\manifest.json'
  if (-not (Test-Path -LiteralPath $manifest)) { return $null }
  try {
    return [string]((Get-Content -LiteralPath $manifest -Raw -Encoding UTF8 | ConvertFrom-Json).version)
  } catch {
    return $null
  }
}

function As-Version([string]$value) {
  if (-not $value) { return $null }
  try { return [Version]$value } catch { return $null }
}

function Wait-ForCleanQuit {
  if ((Get-AppProcesses).Count -eq 0) { return }
  Write-Host
  Write-Host 'Chat On Steroids esta abierto.' -ForegroundColor Yellow
  Write-Host 'Para no cortar un Goal, Loop, terminal o escritura pendiente, este actualizador NO fuerza el cierre.'
  Write-Host 'Cierra CoS desde el icono de la bandeja -> Quit/Salir y vuelve aqui.'
  while ((Get-AppProcesses).Count -gt 0) {
    [void](Read-Host 'Pulsa Enter cuando Chat On Steroids este completamente cerrado')
  }
}

function Download-VerifiedInstaller([string]$tag, [string]$version) {
  $dir = Join-Path $env:TEMP "ChatOnSteroidsUpdater\$version"
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $sums = Join-Path $dir $checksumName
  $installer = Join-Path $dir $installerName
  $base = "https://github.com/$repo/releases/download/$tag"

  Write-Step 'Descargando checksums de la release'
  Invoke-WebRequest -Headers $headers -Uri "$base/$checksumName" -OutFile $sums -UseBasicParsing
  $line = Get-Content -LiteralPath $sums -Encoding UTF8 |
    Where-Object { $_ -match ('^([0-9a-fA-F]{64})\s+\*?' + [Regex]::Escape($installerName) + '$') } |
    Select-Object -First 1
  if (-not $line) { throw "$checksumName no contiene una firma SHA-256 para $installerName" }
  [void]($line -match '^([0-9a-fA-F]{64})')
  $expected = $Matches[1].ToLowerInvariant()

  Write-Step "Descargando Chat On Steroids $version"
  Invoke-WebRequest -Headers $headers -Uri "$base/$installerName" -OutFile $installer -UseBasicParsing
  $actual = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($actual -ne $expected) {
    Remove-Item -LiteralPath $installer -Force -ErrorAction SilentlyContinue
    throw 'El instalador descargado no coincide con el SHA-256 publicado. No se ejecutara.'
  }
  Write-Host 'SHA-256 verificado.' -ForegroundColor Green
  return $installer
}

function Get-TargetRelease {
  try {
    return Invoke-RestMethod -Headers $headers -Uri $api -Method Get
  } catch {
    $apiStatus = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { $null }
    if ($apiStatus -ne 403 -and $apiStatus -ne 429) { throw }
    # The public download URL and checksum are tied to the requested version. API throttling
    # must not prevent installing those verified bytes, or select a moving latest release.
    Write-Host 'GitHub ha limitado la API; se usara la descarga publica de la version solicitada.' -ForegroundColor Yellow
    return [pscustomobject]@{ tag_name = "v$TargetVersion" }
  }
}

function Start-AppIfNeeded([string]$exe) {
  if ((Get-AppProcesses).Count -gt 0) { return }
  if (Test-Path -LiteralPath $exe) {
    Start-Process -FilePath $exe | Out-Null
  }
}

try {
  Write-Host 'Chat On Steroids - actualizador App + Extension' -ForegroundColor White
  Write-Host 'Repositorio: Gokuencinar/chat-on-steroids'

  Write-Step 'Consultando la release solicitada'
  $release = Get-TargetRelease
  if ($release.tag_name -notmatch '^v(\d+\.\d+\.\d+)$') {
    throw "La release mas reciente tiene un tag inesperado: $($release.tag_name)"
  }
  $latestText = $Matches[1]
  $latest = As-Version $latestText
  if (-not $latest) { throw "No se pudo interpretar la version $latestText" }

  $installed = Get-InstalledApp
  $installedVersion = As-Version $installed.Version
  $extensionBefore = Read-ExtensionVersion

  Write-Host "Release disponible : $latestText"
  Write-Host "App instalada      : $(if ($installed.Version) { $installed.Version } else { 'no detectada' })"
  Write-Host "Extension en disco : $(if ($extensionBefore) { $extensionBefore } else { 'no detectada' })"

  $needsApp = (-not $installedVersion) -or ($installedVersion -lt $latest)
  if ($installedVersion -and $installedVersion -gt $latest) {
    Write-Host 'La app instalada es mas nueva que la ultima release publicada; no se hara downgrade.' -ForegroundColor Yellow
    $needsApp = $false
  }

  if ($needsApp) {
    Wait-ForCleanQuit
    $installer = Download-VerifiedInstaller $release.tag_name $latestText
    Write-Step "Instalando $latestText"
    $process = Start-Process -FilePath $installer -ArgumentList '/S','--updated','--force-run' -Wait -PassThru
    if ($process.ExitCode -ne 0) {
      throw "El instalador termino con codigo $($process.ExitCode)"
    }
    Start-Sleep -Seconds 2
    $installed = Get-InstalledApp
    Write-Host "App actualizada a $($installed.Version)." -ForegroundColor Green
  } else {
    Write-Host 'La app ya esta actualizada; no se descarga el instalador.' -ForegroundColor Green
    Start-AppIfNeeded $installed.Exe
  }

  Write-Step 'Sincronizando la extension'
  # The installed app owns this update. On startup it mirrors its bundled extension into
  # %APPDATA%\chat-on-steroids\extension without replacing that root directory, and the running
  # extension asks the local bridge to publish the new build and chrome.runtime.reload() only
  # when no turn/tool/opening is active. Keeping that policy here avoids corrupting a live
  # unpacked-extension directory or interrupting a ChatGPT answer.
  Start-AppIfNeeded $installed.Exe
  $deadline = (Get-Date).AddSeconds(15)
  do {
    Start-Sleep -Milliseconds 750
    $extensionAfter = Read-ExtensionVersion
  } while ($extensionAfter -ne $latestText -and (Get-Date) -lt $deadline)

  if ($extensionAfter -eq $latestText) {
    Write-Host "Archivos de la extension actualizados a $latestText." -ForegroundColor Green
    Write-Host 'Chrome recargara el worker de la extension automaticamente cuando no haya trabajo activo.'
  } else {
    Write-Host 'La app esta actualizada, pero la copia estable de la extension aun no informa la version nueva.' -ForegroundColor Yellow
    Write-Host 'Deja CoS y Chrome abiertos unos segundos sin ningun chat trabajando.'
    Write-Host 'Si siguiera igual, abre Setup -> Extension folder y pulsa Reload una sola vez en chrome://extensions.'
  }

  Write-Host
  Write-Host 'Actualizacion terminada. config.json, secrets.bin, sesiones y plugins no se han tocado.' -ForegroundColor Green
  exit 0
} catch {
  Write-Host
  Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host 'No se ha eliminado la configuracion ni las credenciales de Chat On Steroids.'
  exit 1
}
