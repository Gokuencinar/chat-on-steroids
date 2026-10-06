param([string]$Root)
$ErrorActionPreference = 'Stop'
class MockApiFailure : System.Exception {
  [object]$Response
  MockApiFailure([int]$status) : base("Mock HTTP $status") { $this.Response = [pscustomobject]@{ StatusCode = $status } }
}
function Load-Function([string]$code, [string]$name) {
  $tokens = $null; $errors = $null
  $ast = [Management.Automation.Language.Parser]::ParseInput($code, [ref]$tokens, [ref]$errors)
  if ($errors.Count) { throw ($errors | Out-String) }
  $definition = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name }, $true)
  if (-not $definition) { throw "Missing release-selection owner: $name" }
  # Only the requested function is imported: never execute updater main, registry or installer code.
  . ([ScriptBlock]::Create($definition.Extent.Text.Replace("function $name", "function script:$name")))
}
function Invoke-RestMethod { param($Headers, $Uri, $Method)
  if ($script:status) { throw [MockApiFailure]::new($script:status) }
  return [pscustomobject]@{ tag_name = 'v2.1.37' }
}
function Invoke-WebRequest { param($Headers, $Uri, [switch]$UseBasicParsing)
  $script:requests++
  if ($Uri -ne "https://github.com/$repo/releases/latest") { throw 'Wrong public release owner' }
  if ($script:ps7) { return [pscustomobject]@{ BaseResponse = [pscustomobject]@{ RequestMessage = [pscustomobject]@{ RequestUri = [uri]$script:redirect } } } }
  return [pscustomobject]@{ BaseResponse = [pscustomobject]@{ ResponseUri = [uri]$script:redirect } }
}
function Rejects([scriptblock]$action) {
  $rejected = $false
  try { & $action | Out-Null } catch { $rejected = $true }
  if (-not $rejected) { throw 'Unexpected release accepted' }
}
$repo = 'Gokuencinar/chat-on-steroids'; $headers = @{}
$api = "https://api.github.com/repos/$repo/releases/latest"
$raw = [IO.File]::ReadAllText((Join-Path $Root 'Actualizar-ChatOnSteroids.cmd'))
$marker = '# POWERSHELL_PAYLOAD'
Load-Function $raw.Substring($raw.LastIndexOf($marker) + $marker.Length) 'Get-LatestRelease'
$script:redirect = "https://github.com/$repo/releases/tag/v2.1.37"
$script:requests = 0; $script:status = 0; $script:ps7 = $false
if ((Get-LatestRelease).tag_name -ne 'v2.1.37' -or $script:requests -ne 0) { throw 'Normal API result changed' }
foreach ($script:status in @(403, 429)) {
  $script:requests = 0
  if ((Get-LatestRelease).tag_name -ne 'v2.1.37' -or $script:requests -ne 1) { throw 'Throttled latest release did not use its public redirect' }
}
$script:ps7 = $true
if ((Get-LatestRelease).tag_name -ne 'v2.1.37') { throw 'PowerShell 7 response URI was not accepted' }
$script:ps7 = $false
foreach ($script:status in @(404, 500)) {
  $script:requests = 0; Rejects { Get-LatestRelease }
  if ($script:requests) { throw 'An unrelated API error was hidden' }
}
$script:status = 403
foreach ($script:redirect in @('http://github.com/Gokuencinar/chat-on-steroids/releases/tag/v2.1.37', 'https://example.com/Gokuencinar/chat-on-steroids/releases/tag/v2.1.37', 'https://github.com/other/repo/releases/tag/v2.1.37', 'https://github.com/Gokuencinar/chat-on-steroids/releases/tag/v2.1.37-beta')) { Rejects { Get-LatestRelease } }
Load-Function ([IO.File]::ReadAllText((Join-Path $Root 'scripts/Update-ChatOnSteroids.ps1'))) 'Get-TargetRelease'
$TargetVersion = (Get-Content -LiteralPath (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json).version
foreach ($script:status in @(403, 429)) {
  $script:requests = 0
  if ((Get-TargetRelease).tag_name -ne "v$TargetVersion" -or $script:requests) { throw 'Pinned updater lost its exact tag' }
}
$script:status = 404; Rejects { Get-TargetRelease }
Write-Output 'Release selection assertions passed; no installer or application code executed.'
