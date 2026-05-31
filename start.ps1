# Kursor - PowerShell start script
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Kursor - LatvieSu teksta" -ForegroundColor Cyan
Write-Host "  redaktors ar AI atbalstu" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $rootDir

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[KJUDA] Node.js nav instalets!" -ForegroundColor Red
    Write-Host "Ludzu instalet no: https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Nospiediet Enter, lai izietu"
    exit 1
}

# Install dependencies if needed
if (-not (Test-Path -LiteralPath "node_modules")) {
    Write-Host "Pirma palaide - tiek instaletas atkaribas..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[KJUDA] Neizdevas instalet atkaribas!" -ForegroundColor Red
        Read-Host "Nospiediet Enter, lai izietu"
        exit 1
    }
    Write-Host "Atkaribas veiksmigi instaletas!" -ForegroundColor Green
}

Write-Host "Palaiz Kursor..." -ForegroundColor Green

# Start Vite dev server in background
$viteJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location -LiteralPath $dir
    npx vite 2> $null
} -ArgumentList $rootDir

Start-Sleep -Seconds 3

# Start Electron
npx electron .

# Cleanup
Stop-Job $viteJob -ErrorAction SilentlyContinue
Remove-Job $viteJob -ErrorAction SilentlyContinue
