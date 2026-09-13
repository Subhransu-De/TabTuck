$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
Push-Location $projectRoot
try {
    & bun run build
    if ($LASTEXITCODE -ne 0) { throw 'Extension build failed' }
} finally { Pop-Location }
