# CoS ECC 2.2.3 — opt-in import of 8 workflows, 25 vetted skills and /ecc-all.
# Works from a source checkout or the signed-by-hash installed package.
# Never overwrites personal Skills, configuration or credentials.
[CmdletBinding()]
param(
    [string] $PackageRoot = '',
    [string] $ProfileRoot = (Join-Path $env:APPDATA 'chat-on-steroids'),
    [switch] $ConfirmInstall
)
$ErrorActionPreference = 'Stop'
function Require([bool] $ok, [string] $reason) { if (!$ok) { throw $reason } }
function Digest([string] $file) { (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() }
function Regular([string] $path, [bool] $directory) {
    Require (Test-Path -LiteralPath $path -PathType $(if($directory){'Container'}else{'Leaf'})) ('Missing package component: ' + $path)
    $item = Get-Item -LiteralPath $path -Force
    Require (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) ('Symlink/junction not allowed: ' + $path)
}
if (!$PackageRoot) {
    $PackageRoot = Join-Path $PSScriptRoot '..\resources\ecc\v2.2.3'
}
$PackageRoot = [IO.Path]::GetFullPath($PackageRoot)
Regular $PackageRoot $true
$manifestFile = Join-Path $PackageRoot 'install-manifest.json'
Regular $manifestFile $false
$manifest = Get-Content -LiteralPath $manifestFile -Raw -Encoding UTF8 | ConvertFrom-Json
Require ($manifest.format -eq 'cos-ecc-v2.2.3-v1') 'Unrecognized ECC import manifest'
$entries = @($manifest.entries)
Require ($entries.Count -eq 34) 'Expected 8 workflows, 25 vetted ECC Skills and /ecc-all'
$seen = @{}
foreach ($entry in $entries) {
    $id = [string]$entry.id
    $sourceType = [string]$entry.source
    Require ($id -match '^[a-z][a-z0-9-]{0,63}$' -and $sourceType -in @('skills','workflows') -and
             [string]$entry.sha256 -match '^[0-9a-f]{64}$') 'Invalid manifest entry'
    Require (!$seen.ContainsKey($id)) ('Duplicate manifest entry: ' + $id)
    Require (($sourceType -eq 'skills') -eq (!$id.StartsWith('ecc-'))) ('Unexpected ECC source type: ' + $id)
    $seen[$id] = $true
    $folder = Join-Path (Join-Path $PackageRoot $sourceType) $id
    Regular $folder $true
    $files = @(Get-ChildItem -LiteralPath $folder -Force)
    Require ($files.Count -eq 1 -and $files[0].Name -ceq 'SKILL.md') ('Unexpected ECC package contents: ' + $id)
    $file = Join-Path $folder 'SKILL.md'
    Regular $file $false
    Require ((Digest $file) -ceq [string]$entry.sha256) ('ECC SHA256 mismatch: ' + $id)
}
foreach ($type in @('skills','workflows')) {
    $dir = Join-Path $PackageRoot $type
    Regular $dir $true
    $actual = @(Get-ChildItem -LiteralPath $dir -Force)
    $expected = @($entries | Where-Object { $_.source -eq $type })
    Require ($actual.Count -eq $expected.Count -and @($actual | Where-Object { !$_.PSIsContainer -or !$seen.ContainsKey($_.Name) }).Count -eq 0) ('Unexpected package directory contents: ' + $type)
}
$target = Join-Path $ProfileRoot 'skills'
Require (Test-Path -LiteralPath $ProfileRoot -PathType Container) 'Open CoS once before importing its Skills'
Regular $ProfileRoot $true
if (Test-Path -LiteralPath $target) { Regular $target $true }
$existing = if(Test-Path -LiteralPath $target) { @(Get-ChildItem -LiteralPath $target -Directory -Force) } else { @() }
$new = @($entries | Where-Object { !(Test-Path -LiteralPath (Join-Path $target ([string]$_.id))) })
Require (($existing.Count + $new.Count) -le 64) ('Insufficient capacity: ' + $existing.Count + ' already installed, ' + $new.Count + ' missing, maximum 64')
Write-Host ('ECC package verified: 25 Skills + 8 workflows + /ecc-all. New: ' + $new.Count + '; preserved: ' + (34 - $new.Count))
if (!$ConfirmInstall) {
    Write-Host 'Preview only. Re-run with -ConfirmInstall after explicit user approval.'
    return
}
$processes = @(Get-Process -Name 'Chat On Steroids' -ErrorAction SilentlyContinue)
Require ($processes.Count -eq 0) 'Close Chat On Steroids from the tray before importing Skills'
if (!(Test-Path -LiteralPath $target)) { [void](New-Item -ItemType Directory -Path $target) }
Regular $target $true
$done = 0
foreach ($entry in $new) {
    $id = [string]$entry.id
    $dest = Join-Path $target $id
    if (Test-Path -LiteralPath $dest) { continue }
    $stage = Join-Path $target ('.ecc-stage-' + [guid]::NewGuid().ToString('N'))
    try {
        [void](New-Item -ItemType Directory -Path $stage -ErrorAction Stop)
        $sourceFile = Join-Path (Join-Path (Join-Path $PackageRoot $entry.source) $id) 'SKILL.md'
        Copy-Item -LiteralPath $sourceFile -Destination (Join-Path $stage 'SKILL.md') -ErrorAction Stop
        Require ((Digest (Join-Path $stage 'SKILL.md')) -eq [string]$entry.sha256) ('Copy checksum mismatch: ' + $id)
        if (!(Test-Path -LiteralPath $dest)) {
            [IO.Directory]::Move($stage, $dest)
            $done++
        }
    } finally {
        if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
    }
}
Write-Host ('Imported ' + $done + ' missing ECC Skills; existing personal Skills remain unchanged.')
