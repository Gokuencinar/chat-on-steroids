@echo off
setlocal EnableExtensions DisableDelayedExpansion
title CoS 2.1.45 - ECC Skills y nueve apariencias
rem SOLO compilacion local. No Git fetch/merge/commit, no borrado de AppData,
rem no cierre forzado de procesos, no desinstalacion ni limpieza de carpetas.
rem Sin argumentos: typecheck/tests, compilar, confirmar, respaldo e instalar.
rem /check o /quiet: solo comprobar artefacto actual; /build-only: compilar sin instalar.
rem /install-built: instalar un artefacto local ya compilado y verificado.
rem /skills-only: importar 33 ECC Skills + /ecc-all con autorizacion.
rem Los nueve estilos visuales vienen integrados en el programa.
rem /install-built + COS_ECC_ASSUME_YES=1: instalacion silenciosa tras respaldo.
set "COS_ECC_UPDATER=%~f0"
set "COS_ECC_MODE=%~1"
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; $raw=[IO.File]::ReadAllText($env:COS_ECC_UPDATER); $marker='# POWERSHELL_PAYLOAD'; $pos=$raw.LastIndexOf($marker); if($pos -lt 0){throw 'Falta el contenido del actualizador'}; & ([ScriptBlock]::Create($raw.Substring($pos+$marker.Length)))"
set "COS_ECC_EXIT=%ERRORLEVEL%"
echo.
rem Una condicion por linea: las cadenas IF anidadas pueden fallar al volver
rem de PowerShell y ocultar su exit code, aunque el empaquetado termine bien.
if /I "%COS_ECC_MODE%"=="/check" goto :cos_ecc_exit
if /I "%COS_ECC_MODE%"=="/quiet" goto :cos_ecc_exit
if "%COS_ECC_NO_PAUSE%"=="1" goto :cos_ecc_exit
if "%COS_UPDATER_NO_PAUSE%"=="1" goto :cos_ecc_exit
pause
:cos_ecc_exit
exit /b %COS_ECC_EXIT%

# POWERSHELL_PAYLOAD
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$version = '2.1.45'
$root = [IO.Path]::GetFullPath((Split-Path -Parent $env:COS_ECC_UPDATER))
$mode = [string]$env:COS_ECC_MODE
if ($mode -eq '/quiet') { $mode = '/check' } # No interactive installer in noninteractive mode.
$installer = Join-Path $root 'release\Chat-On-Steroids-Setup-x64.exe'
$unpacked = Join-Path $root 'release\win-unpacked'
$buildPin = Join-Path $root 'release\CoS-2.1.45-local-build.json'
$resourceSkills = Join-Path $root 'resources\ecc\v2.2.3\skills'
$packagedSkills = Join-Path $unpacked 'resources\ecc\v2.2.3\skills'
$packagedEcc = Join-Path $unpacked 'resources\ecc\v2.2.3'
$importer = Join-Path $root 'scripts\import-ecc-pack.ps1'
$backupRoot = Join-Path $env:LOCALAPPDATA 'CoS-ECC-Install-Backups'

function Step([string]$message) {
  Write-Host
  Write-Host ('==> ' + $message) -ForegroundColor Cyan
}
function Need([bool]$condition, [string]$message) {
  if (-not $condition) { throw $message }
}
function Require-File([string]$file) {
  Need (Test-Path -LiteralPath $file -PathType Leaf) ('Falta el archivo: ' + $file)
  $item = Get-Item -LiteralPath $file -Force -ErrorAction Stop
  Need (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) ('Archivo redirigido: ' + $file)
  return $item
}
function Require-Directory([string]$folder) {
  Need (Test-Path -LiteralPath $folder -PathType Container) ('Falta la carpeta: ' + $folder)
  $item = Get-Item -LiteralPath $folder -Force -ErrorAction Stop
  Need (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) ('Carpeta redirigida: ' + $folder)
  return $item
}
function Sha([string]$file) { (Get-FileHash -LiteralPath $file -Algorithm SHA256 -ErrorAction Stop).Hash }
function Source-Fingerprints {
  $all = New-Object System.Collections.ArrayList
  foreach ($folder in @('src','extension','scripts','resources\ecc\v2.2.3\skills','resources\ecc\v2.2.3\workflows')) {
    $base = Join-Path $root $folder
    [void](Require-Directory $base)
    foreach ($file in @(Get-ChildItem -LiteralPath $base -Recurse -File -Force -ErrorAction Stop)) {
      [void](Require-File $file.FullName)
      $relative = $file.FullName.Substring($root.Length + 1).Replace('\','/')
      [void]$all.Add([pscustomobject]@{ path=$relative; sha256=(Sha $file.FullName) })
    }
  }
  foreach ($name in @('package.json','package-lock.json','electron-builder.yml',
                     'docs\ecc-all\SKILL.md','resources\ecc\v2.2.3\install-manifest.json',
                     'docs\licenses\ecc-LICENSE','Actualizar-CoS-ECC-Skills-Apariencias-2.1.45.cmd')) {
    $file = Join-Path $root $name
    [void](Require-File $file)
    [void]$all.Add([pscustomobject]@{ path=$name.Replace('\','/'); sha256=(Sha $file) })
  }
  Need ($all.Count -gt 100 -and $all.Count -lt 10000) 'Inventario de fuentes inesperadamente pequeno o grande.'
  return @($all | Sort-Object path)
}
function Save-Build-Pin {
  $record = [ordered]@{
    version = $version
    installerSha256 = (Sha $installer)
    asarSha256 = (Sha (Join-Path $unpacked 'resources\app.asar'))
    sources = @(Source-Fingerprints)
  }
  $json = ConvertTo-Json -InputObject $record -Depth 6
  [IO.File]::WriteAllText($buildPin, $json + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))
  Write-Host ('Integridad registrada para ' + $record.sources.Count + ' archivos fuente.') -ForegroundColor Green
}
function Verify-Build-Pin {
  [void](Require-File $buildPin)
  $pin = Get-Content -LiteralPath $buildPin -Raw -Encoding UTF8 | ConvertFrom-Json
  Need ($pin.version -eq $version) 'El manifiesto pertenece a otra version.'
  Need ($pin.installerSha256 -eq (Sha $installer)) 'Instalador diferente de la compilacion verificada.'
  Need ($pin.asarSha256 -eq (Sha (Join-Path $unpacked 'resources\app.asar'))) 'app.asar diferente de la compilacion verificada.'
  $live = @(Source-Fingerprints)
  $saved = @($pin.sources)
  Need ($live.Count -eq $saved.Count) 'El inventario de fuentes cambio tras compilar; reconstruye el instalador.'
  for ($i=0; $i -lt $live.Count; $i++) {
    Need ($live[$i].path -ceq $saved[$i].path -and $live[$i].sha256 -eq $saved[$i].sha256) ('Fuente modificada despues de compilar: ' + $live[$i].path)
  }
  Write-Host ('Hashes de instalador, app.asar y ' + $live.Count + ' fuentes: CORRECTOS.') -ForegroundColor Green
}
function Assert-Exit([string]$message) {
  if ($LASTEXITCODE -ne 0) { throw ($message + ': codigo ' + $LASTEXITCODE) }
}
function App-Registry {
  $locations = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  $entries = @(Get-ItemProperty -Path $locations -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -eq 'Chat On Steroids' })
  Need ($entries.Count -eq 1) 'Instalacion ausente o registro ambiguo. No se crea una instalacion paralela.'
  $entry = $entries[0]
  $uninstall = [string]$entry.UninstallString
  Need ($uninstall -match '^\s*"([^"]+\\Uninstall Chat On Steroids\.exe)"(?:\s|$)') 'Ruta de desinstalacion no reconocida en el registro.'
  $directory = [IO.Path]::GetFullPath((Split-Path -Parent $Matches[1]))
  [void](Require-Directory $directory)
  $exe = Join-Path $directory 'Chat On Steroids.exe'
  [void](Require-File $exe)
  [void](Require-File (Join-Path $directory 'resources\app.asar'))
  $data = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'chat-on-steroids'))
  Need (-not $directory.StartsWith($data.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) 'La ruta de instalacion invade datos de usuario.'
  return [pscustomobject]@{ Path=$directory; Exe=$exe; Version=[string]$entry.DisplayVersion }
}
function Check-Processes([string]$installPath) {
  $running = @(Get-Process -Name 'Chat On Steroids' -ErrorAction SilentlyContinue)
  $helpers = @(Get-CimInstance Win32_Process -Filter "Name = 'tunnel-client.exe'" -ErrorAction Stop |
    Where-Object { $_.ExecutablePath -and
      $_.ExecutablePath.StartsWith($installPath.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase) })
  if ($running.Count -gt 0 -or $helpers.Count -gt 0) {
    throw ("CoS sigue abierto ({0} procesos) o tiene tuneles activos ({1}). Guarda el trabajo y usa Bandeja > Quit/Salir; el CMD nunca fuerza el cierre." -f $running.Count,$helpers.Count)
  }
}
function Check-EccPackage {
  [void](Require-Directory (Join-Path $root 'release'))
  [void](Require-Directory $unpacked)
  [void](Require-Directory (Join-Path $unpacked 'resources'))
  $builtInstaller = Require-File $installer
  $builtAsar = Require-File (Join-Path $unpacked 'resources\app.asar')
  [void](Require-File (Join-Path $unpacked 'Chat On Steroids.exe'))
  [void](Require-File (Join-Path $unpacked 'resources\extension\manifest.json'))
  [void](Require-File (Join-Path $unpacked 'resources\extension\build-stamp.txt'))
  [void](Require-File (Join-Path $unpacked 'resources\LICENSE.ecc.txt'))
  [void](Require-Directory $resourceSkills)
  [void](Require-Directory $packagedSkills)
  [void](Require-File (Join-Path $packagedEcc 'install-manifest.json'))
  [void](Require-File (Join-Path $unpacked 'resources\ecc\import-ecc-pack.ps1'))
  Need ((Sha (Join-Path $root 'resources\ecc\v2.2.3\install-manifest.json')) -eq
    (Sha (Join-Path $packagedEcc 'install-manifest.json'))) 'Manifiesto ECC diferente de la compilacion.'
  Need ((Sha $importer) -eq (Sha (Join-Path $unpacked 'resources\ecc\import-ecc-pack.ps1'))) 'Importador ECC no coincide con el empaquetado.'
  & node.exe scripts/generate-ecc-install-resources.mjs --check
  Assert-Exit 'ECC workflows y manifest'
  $workflows = Get-Content -LiteralPath (Join-Path $packagedEcc 'install-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  Need ($workflows.format -eq 'cos-ecc-v2.2.3-v1' -and @($workflows.entries).Count -eq 34) 'Manifiesto ECC incompleto.'
  foreach ($item in @($workflows.entries | Where-Object { $_.source -eq 'workflows' })) {
    $rel = Join-Path (Join-Path 'workflows' ([string]$item.id)) 'SKILL.md'
    $original = Join-Path (Join-Path $root 'resources\ecc\v2.2.3') $rel
    $built = Join-Path $packagedEcc $rel
    [void](Require-File $built)
    Need ((Sha $original) -eq (Sha $built) -and (Sha $built).ToLowerInvariant() -ceq [string]$item.sha256) ('Workflow cambiado: ' + $item.id)
  }
  # Only the twenty-five positively reviewed entries in src/shared/ecc-catalog.ts.
  # Fail closed if packaging accidentally includes any of the other 268 ECC Skills.
  $allowedEcc = @{
    'accessibility' = 'eeeba35e39d29256d07bd3755cac6a3fad14d4365a952ce817d99f486331c200'
    'agent-harness-construction' = 'e7fb390a6663b46ea5d3c2876753a5ce32ba3bad1889686b21a42894caa1742d'
    'agent-introspection-debugging' = '1c07355daa9aaed7c5fa3ec1b3c876951dcc59db781f98ff279b49144dc4478f'
    'ai-first-engineering' = '114913bdcb6127392df56d96f7f1312f36c74d69c278dece6d377b9bd92123a5'
    'ai-regression-testing' = 'd1c2278e3be8d3940919ae6a7611c77d87039359198018aa6486b13e1f11e839'
    'api-design' = '250e464413a13c0eb93cc73447b423df1f9aa8e4f80e5e68c41f895b2c33e352'
    'architecture-decision-records' = '263b20e81801aa5fa7e75eaec6c38345c0ac028ca0edbd67b1b9071c5fcbe11f'
    'backend-patterns' = '9b983d0297a983110fdfda8dce55d19b750ca3e53ef155d75a3eff740d3874b8'
    'benchmark-methodology' = 'f24585262b9c3e106dc27d45f75c4b965501680a16ff6dc5a9995a53322549df'
    'benchmark-optimization-loop' = '816b09033e1039eeecceca54b6b329ac12f5ec400f5fc279b8fa205a9bd0feae'
    'click-path-audit' = '42411eefa0c2cc65222e77d762541a27d76677d349bec5eaf4365e32a0bb29cd'
    'coding-standards' = 'e80544c3d1eac5b14f22022146bd91a6b0ecc30e099cf5181894853aeb81dee1'
    'content-hash-cache-pattern' = 'c0242ee2fcb5c096d0625cb6957481fce2266e92985036795f5b5c13c329d802'
    'contract-first' = '3eaacf16a9bbd92888659e9c1e15b0fa4eb96a41c257dd9e08f2e63b824f0cea'
    'error-handling' = 'e8eec6756c950b570486493e64e3bf14c12baf6bf0858bf3928097fe2bfeaf79'
    'frontend-a11y' = 'e00991a3f4d47fcf1529dd74a080afcf46137dc5061e70dc6e3da7b27f2ae3f3'
    'frontend-patterns' = 'a5b971eb9e74cd763c7e3308bfd888e0d9cf69f8b88477659889d77182479740'
    'hexagonal-architecture' = '1579f70e4cd5a2dde39d29a2055d18b39f06b063a308d3b43a498900c99495b7'
    'i18n-sync' = 'f83395d39aa7d81c8bcd184dbcd07cd8ceed251097639c9e5e53f39539f3c976'
    'intent-driven-development' = 'e34045f7b3bf6a6fbd364f85c7bc81d8208e18bb929ceff80bbc987f78aadea8'
    'iterative-retrieval' = 'b453b16d3e36174b8487c05ab807d0321a66c2d058812b2ae129d82824183725'
    'kotlin-patterns' = 'e519234772a3697763ad484908d180c4c653439fea75a56c03440c272f9f0896'
    'living-docs-governance' = 'e8c22a1f69743e256c6d6df138d99e49d22e29effbf008dfe2328b7fdc76247e'
    'production-audit' = '3ab3dd8a364ee17566e9361f0ebed2aec3b3146ede44e1db0a72c5ceae1ca0a4'
    'python-patterns' = '103e0130dac33a49d26705fc5a2df804980fcab6a0138d65bc7f370a987d49f6'
  }
  $catalog = Get-Content -LiteralPath (Join-Path $root 'src\shared\ecc-catalog.ts') -Raw -Encoding UTF8
  $catalogIds = @([regex]::Matches($catalog, '"id"\s*:\s*"([^"]+)"') | ForEach-Object { $_.Groups[1].Value } | Sort-Object)
  $catalogPins = @([regex]::Matches($catalog, '(?s)"id"\s*:\s*"([^"]+)".{0,1024}?"sha256"\s*:\s*"([a-f0-9]{64})"'))
  $expectedNames = @($allowedEcc.Keys | Sort-Object)
  Need ($catalogIds.Count -eq 25 -and $catalogPins.Count -eq 25 -and
    ([string]::Join('|',$catalogIds)) -ceq ([string]::Join('|',$expectedNames))) 'Catalogo ECC modificado: revisar allowlist antes de ejecutar este CMD.'
  foreach ($pin in $catalogPins) {
    Need ($allowedEcc.ContainsKey($pin.Groups[1].Value) -and
      $allowedEcc[$pin.Groups[1].Value] -eq $pin.Groups[2].Value) 'Hashes del catalogo ECC distintos de la revision revisada.'
  }
  $source = @(Get-ChildItem -LiteralPath $resourceSkills -Force -ErrorAction Stop)
  $built = @(Get-ChildItem -LiteralPath $packagedSkills -Force -ErrorAction Stop)
  $sourceNames = @($source | ForEach-Object { $_.Name } | Sort-Object)
  $builtNames = @($built | ForEach-Object { $_.Name } | Sort-Object)
  Need ($source.Count -eq 25 -and $built.Count -eq 25 -and
    ([string]::Join('|',$sourceNames)) -ceq ([string]::Join('|',$expectedNames)) -and
    ([string]::Join('|',$builtNames)) -ceq ([string]::Join('|',$expectedNames))) ('ECC tiene entradas extra/no aprobadas: origen ' + $source.Count + ', empaquetado ' + $built.Count)
  $manifest = Get-Content -LiteralPath (Join-Path $unpacked 'resources\extension\manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  Need ($manifest.version -eq $version) 'La extension empaquetada tiene otra version.'
  # If any source changed after the build, prevent installing an older ECC candidate.
  $critical = @(
    'package.json','package-lock.json','electron-builder.yml','src\main\version.ts',
    'src\main\ipc.ts','src\main\mcp\surfaces.ts','src\main\mcp\tools-core.ts',
    'src\main\ecc-memory.ts','src\main\ecc-security.ts','src\main\ecc-catalog.ts',
    'src\main\ecc-learning.ts','src\main\ecc-learning-bridge.ts',
    'src\main\session\recorder.ts','src\main\session\prompt.ts',
    'src\main\dictation.ts','src\main\index.ts',
    'src\main\recommended-skills.ts','src\shared\ecc-memory.ts',
    'src\shared\ecc-security.ts','src\shared\ecc-skills.ts','src\shared\ecc-catalog.ts',
    'src\shared\ecc-learning.ts','src\shared\dictation.ts',
    'src\preload\index.ts','src\renderer\skills-library.ts',
    'src\renderer\ecc-workspace.ts','src\renderer\ecc-learning-ui.ts',
    'src\renderer\chat.ts','src\renderer\dictation.css','src\renderer\index.html',
    'src\renderer\locales\es.json','src\renderer\locales\de.json',
    'src\renderer\locales\fr.json','src\renderer\locales\ja.json',
    'src\renderer\locales\ko.json','src\renderer\locales\ru.json',
    'src\renderer\locales\tr.json','src\renderer\locales\vi.json',
    'src\renderer\locales\pt-PT.json','src\renderer\locales\pt-BR.json',
    'src\renderer\locales\zh-CN.json','src\renderer\locales\zh-TW.json',
    'scripts\generate-ecc-catalog.mjs','docs\licenses\ecc-LICENSE'
  )
  foreach ($relative in $critical) {
    $file = Join-Path $root $relative
    $item = Require-File $file
    Need ($item.LastWriteTimeUtc -le $builtAsar.LastWriteTimeUtc.AddSeconds(4)) ('Codigo ECC mas reciente que app.asar; vuelve a compilar: ' + $relative)
  }
  foreach ($name in $expectedNames) {
    $sourceFolder = Join-Path $resourceSkills $name
    $builtFolder = Join-Path $packagedSkills $name
    [void](Require-Directory $sourceFolder)
    [void](Require-Directory $builtFolder)
    $sourceFiles = @(Get-ChildItem -LiteralPath $sourceFolder -Force -ErrorAction Stop)
    $builtFiles = @(Get-ChildItem -LiteralPath $builtFolder -Force -ErrorAction Stop)
    Need ($sourceFiles.Count -eq 1 -and $sourceFiles[0].Name -ceq 'SKILL.md' -and
      $builtFiles.Count -eq 1 -and $builtFiles[0].Name -ceq 'SKILL.md') ('Skill ECC contiene archivos no revisados: ' + $name)
    $original = Join-Path $sourceFolder 'SKILL.md'
    $other = Join-Path $builtFolder 'SKILL.md'
    [void](Require-File $original)
    [void](Require-File $other)
    $hash = Sha $original
    Need ($hash.ToLowerInvariant() -eq $allowedEcc[$name] -and $hash -eq (Sha $other)) ('Recurso ECC cambiado/no aprobado: ' + $name)
  }
  Need ($builtInstaller.LastWriteTimeUtc -ge $builtAsar.LastWriteTimeUtc.AddSeconds(-4)) 'EXE instalador anterior a app.asar. Reconstruye el paquete.'
  Verify-Build-Pin
  Write-Host ('Candidata ECC verificada: ' + $source.Count + ' Skills aprobadas, app.asar y extension ' + $version) -ForegroundColor Green
  Write-Host ('Instalador: ' + $installer)
  Write-Host ('SHA-256: ' + (Sha $installer))
}
function Backup-Install([string]$source) {
  Step 'Copia de seguridad de la aplicacion instalada (no de AppData)'
  if (-not (Test-Path -LiteralPath $backupRoot)) {
    [void](New-Item -ItemType Directory -Path $backupRoot -ErrorAction Stop)
  }
  [void](Require-Directory $backupRoot)
  Need (-not $source.StartsWith($backupRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) 'La instalacion esta dentro del destino de respaldo.'
  $links = @(Get-ChildItem -LiteralPath $source -Force -Recurse -ErrorAction Stop |
    Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint } | Select-Object -First 1)
  Need ($links.Count -eq 0) 'La instalacion contiene un enlace/junction; respaldo total no verificable. Instalacion cancelada.'
  $destination = Join-Path $backupRoot ('2.1.45-before-ECC-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8))
  Need (-not (Test-Path -LiteralPath $destination)) 'El respaldo ya existe; no se sobrescribira.'
  [void](New-Item -ItemType Directory -Path $destination -ErrorAction Stop)
  # No /MIR, no /PURGE, no /MOVE, no /DEL: copy only, never delete original.
  & robocopy.exe $source $destination /E /XJ /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NP /NFL /NDL /NJH /NJS | Out-Host
  $result = $LASTEXITCODE
  Need ($result -lt 4) ('El respaldo no se pudo completar sin discrepancias (robocopy ' + $result + '). No se instalara. Copia parcial: ' + $destination)
  foreach ($relative in @('Chat On Steroids.exe','resources\app.asar','resources\extension\manifest.json')) {
    $original = Join-Path $source $relative
    if (Test-Path -LiteralPath $original -PathType Leaf) {
      $saved = Join-Path $destination $relative
      [void](Require-File $saved)
      Need ((Sha $original) -eq (Sha $saved)) ('Respaldo no coincide: ' + $relative)
    }
  }
  Write-Host ('Respaldo preservado en: ' + $destination) -ForegroundColor Green
  return $destination
}

try {
  Need ($mode -in @('', '/check','/build-only','/install-built','/skills-only')) 'Usa /check, /build-only, /install-built, /skills-only o sin argumentos.'
  Need ($env:OS -eq 'Windows_NT' -and [Environment]::Is64BitOperatingSystem) 'Solo Windows x64.'
  Need ($env:LOCALAPPDATA -and $env:APPDATA) 'No se pudieron localizar LOCALAPPDATA y APPDATA.'
  [void](Require-Directory $root)
  Set-Location -LiteralPath $root
  if ($mode -eq '/skills-only') {
    $installed = App-Registry
    Check-Processes $installed.Path
    $installedEcc = Join-Path $installed.Path 'resources\ecc\v2.2.3'
    [void](Require-File (Join-Path $installedEcc 'install-manifest.json'))
    & $importer -PackageRoot $installedEcc
    if ($env:COS_ECC_INSTALL_SKILLS -eq '1' -or (Read-Host 'Instalar Skills ECC faltantes sin sobrescribir personalizadas? [S/N]') -match '^[sSyY]$') {
      & $importer -PackageRoot $installedEcc -ConfirmInstall
    }
    Write-Host 'Los nueve estilos estan disponibles en Ajustes > Apariencia.'
    exit 0
  }
  foreach ($binary in @('node.exe','npm.cmd','robocopy.exe','powershell.exe')) {
    Need ([bool](Get-Command $binary -ErrorAction SilentlyContinue)) ('Falta ' + $binary + ' en PATH.')
  }
  foreach ($relative in @('package.json','package-lock.json','electron-builder.yml',
                          'scripts\package.mjs','extension\manifest.json','src\main\version.ts')) {
    [void](Require-File (Join-Path $root $relative))
  }
  $pkg = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $ext = Get-Content -LiteralPath (Join-Path $root 'extension\manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
  $appSource = Get-Content -LiteralPath (Join-Path $root 'src\main\version.ts') -Raw -Encoding UTF8
  $found = [regex]::Match($appSource, "APP_VERSION\s*=\s*'([^']+)'")
  $locks = (& node.exe -p "JSON.stringify([require('./package-lock.json').version,require('./package-lock.json').packages[''].version])") | ConvertFrom-Json
  Assert-Exit 'Leer package-lock.json'
  $versions = @($pkg.version,$ext.version,$found.Groups[1].Value,$locks[0],$locks[1])
  Need (@($versions | Where-Object { $_ -ne $version }).Count -eq 0) 'Versiones de app/extension/lockfile distintas de 2.1.45.'
  Write-Host 'Chat On Steroids 2.1.45 / ECC + 9 apariencias + dictado - LOCAL Windows x64'
  Write-Host ('Repositorio: ' + $root)
  Write-Host '9 apariencias integradas; el paquete ECC es opcional y conserva personalizaciones.'
  if ($mode -eq '' -or $mode -eq '/build-only') {
    [void](Require-Directory (Join-Path $root 'node_modules\electron-vite'))
    Step 'Typecheck'
    & npm.cmd run typecheck
    Assert-Exit 'TypeScript'
    Step 'Pruebas ECC, aprendizaje nativo y dictado'
    & npm.cmd exec -- vitest run test/ecc-install-resources.test.ts test/ecc-security.test.ts test/ecc-memory.test.ts test/ecc-catalog.test.ts test/ecc-learning.test.ts test/ecc-learning-bridge.test.ts test/ecc-learning-ui.test.ts test/ecc-workspace-renderer.test.ts test/recommended-skills.test.ts test/skills-library-renderer.test.ts test/ecc-navigation.test.ts test/dictation-openai.test.ts test/renderer-dictation-openai.test.ts test/dictation-lifecycle.test.ts test/renderer-dictation.test.ts test/dictation.test.ts test/cos-browser-microphone-permission.test.ts test/cos-browser-sign-in-host.test.ts test/whats-new.test.ts test/renderer-i18n.test.ts test/bridge.test.ts test/image-export.test.ts test/update.test.ts test/codex-apply-patch-bom.test.ts --maxWorkers=2
    Assert-Exit 'Pruebas ECC/aprendizaje/dictado'
    Step 'Compilando NSIS x64 desde este repositorio (puede descargar dependencias de empaquetado)'
    & npm.cmd run dist:x64
    Assert-Exit 'npm run dist:x64'
    Step 'Registrando hashes de fuentes y artefactos exactos'
    Save-Build-Pin
  }
  Step 'Verificando instalador local ECC'
  Check-EccPackage
  if ($mode -eq '/build-only') {
    Write-Host 'BUILD COMPLETO. No se ha abierto el instalador ni tocado la instalacion.' -ForegroundColor Green
    exit 0
  }
  $installed = App-Registry
  Write-Host ('Instalado: ' + $installed.Path + ' (registro: ' + $installed.Version + ')')
  Need ([bool]$installed.Version) 'El registro de la aplicacion instalada no tiene version.'
  Need ([version]$installed.Version -le [version]$version) 'La version instalada es mas nueva: no se permite degradar la instalacion.'
  if ($mode -eq '/check') {
    Write-Host 'CHECK CORRECTO. Sin escrituras, backup ni instalacion.' -ForegroundColor Green
    try {
      Check-Processes $installed.Path
      Write-Host 'ESTADO: no se detectan bloqueos por procesos activos.'
    } catch {
      Write-Host ('BLOQUEADO PARA INSTALAR: ' + $_.Exception.Message) -ForegroundColor Yellow
    }
    exit 0
  }
  Step 'Aprobacion final'
  Write-Host 'Antes de continuar se copiara TODA la carpeta instalada a LOCALAPPDATA\CoS-ECC-Install-Backups.'
  Write-Host 'La configuracion en APPDATA\chat-on-steroids queda fuera del respaldo y fuera del instalador.'
  Write-Host 'El instalador NSIS sera interactivo: selecciona la MISMA carpeta que muestra arriba.'
  if ($mode -ne '/install-built' -or $env:COS_ECC_ASSUME_YES -ne '1') {
    $answer = Read-Host 'Hacer respaldo e iniciar instalacion de ECC 2.1.45? [S/N]'
    if ($answer -notmatch '^[sSyY]$') {
      Write-Host 'Cancelado sin cambios en la instalacion.'
      exit 0
    }
  }
  Check-Processes $installed.Path
  $saved = Backup-Install $installed.Path
  Check-Processes $installed.Path
  if ($mode -eq '/install-built') {
    Step 'Ejecutando NSIS /S sin preguntas (solo por solicitud explicita /install-built)'
    $process = Start-Process -FilePath $installer -ArgumentList @('/S','--updated') -WindowStyle Hidden -Wait -PassThru
  } else {
    Step 'Ejecutando NSIS (interactivo)'
    $process = Start-Process -FilePath $installer -Wait -PassThru
  }
  Need ($process.ExitCode -eq 0) ('NSIS fallo/cancelado con codigo ' + $process.ExitCode + '. Respaldo: ' + $saved)
  $after = App-Registry
  Need ($after.Path -eq $installed.Path) ('La ruta de instalacion cambio; NO se acepta. Respaldo: ' + $saved)
  Need ([version]$after.Version -eq [version]$version) ('El registro no confirma la version ' + $version + '. Respaldo: ' + $saved)
  foreach ($relative in @('Chat On Steroids.exe','resources\app.asar',
                          'resources\extension\manifest.json','resources\extension\build-stamp.txt',
                          'resources\LICENSE.ecc.txt')) {
    $expected = Join-Path $unpacked $relative
    $actual = Join-Path $after.Path $relative
    [void](Require-File $actual)
    Need ((Sha $actual) -eq (Sha $expected)) ('Archivo instalado diferente: ' + $relative + '. Respaldo: ' + $saved)
  }
  [void](Require-Directory (Join-Path $after.Path 'resources\ecc\v2.2.3\skills'))
  [void](Require-Directory (Join-Path $after.Path 'resources\ecc\v2.2.3\workflows'))
  Write-Host ('ACTUALIZACION Y HASHES VERIFICADOS. Respaldo: ' + $saved) -ForegroundColor Green
  Write-Host 'Los 9 estilos visuales estan disponibles en Ajustes > Apariencia.'
  if ($env:COS_ECC_INSTALL_SKILLS -eq '1' -or (Read-Host 'Importar 8 workflows, 25 Skills ECC y /ecc-all sin sobrescribir personalizadas? [S/N]') -match '^[sSyY]$') {
    Check-Processes $after.Path
    & $importer -PackageRoot (Join-Path $after.Path 'resources\ecc\v2.2.3') -ConfirmInstall
  }
  Write-Host 'No se modificaron otras preferencias, credenciales ni sesiones.'
  exit 0
} catch {
  Write-Host
  Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
  Write-Host 'No se cerraron procesos, borraron carpetas ni tocaron datos de usuario.'
  Write-Host 'Si NSIS ya se inicio, revisa el resultado antes de recuperar archivos desde el respaldo.'
  exit 1
}
