#Requires -Version 5.1
# ============================================================
# COTA - Instalador para Windows
# Instala o COTA (formacao CAD + CNC) no usuario atual:
#   - arquivos em %LOCALAPPDATA%\COTA (nao precisa de administrador)
#   - atalho na Area de Trabalho com icone e modo aplicativo
#   - entrada no Menu Iniciar + desinstalador
# ============================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'Stop'

$AppName  = 'COTA - Formacao CNC'
$Version  = '6.5.0'
$Src      = $PSScriptRoot
$InstallDir = Join-Path $env:LOCALAPPDATA 'COTA'

function Write-Banner {
    Write-Host ''
    Write-Host '  ==========================================================' -ForegroundColor Cyan
    Write-Host '   COTA - do desenho a peca pronta  |  v$Version' -ForegroundColor Cyan
    Write-Host '   Instalador para Windows - Formacao em CAD + CNC' -ForegroundColor Cyan
    Write-Host '  ==========================================================' -ForegroundColor Cyan
    Write-Host ''
}

Write-Banner

# ---------- 1. valida arquivos de origem ----------
Write-Host ' [1/6] Verificando arquivos de instalacao...' -ForegroundColor Yellow
$itens = @('index.html', 'manifest.json', 'css', 'js', 'assets')
foreach ($item in $itens) {
    if (-not (Test-Path (Join-Path $Src $item))) {
        Write-Host '  ERRO: arquivo/pasta ausente: ' $item -ForegroundColor Red
        Write-Host '  Execute o instalador a partir da pasta extraida do ZIP completo.' -ForegroundColor Red
        exit 1
    }
}
Write-Host '  OK - arquivos completos.' -ForegroundColor Green

# ---------- 2. copia os arquivos ----------
Write-Host ' [2/6] Instalando em' $InstallDir '...' -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
Copy-Item (Join-Path $Src 'index.html')     $InstallDir -Force
Copy-Item (Join-Path $Src 'manifest.json')  $InstallDir -Force
Copy-Item (Join-Path $Src 'css')            $InstallDir -Recurse -Force
Copy-Item (Join-Path $Src 'js')             $InstallDir -Recurse -Force
Copy-Item (Join-Path $Src 'assets')         $InstallDir -Recurse -Force
Set-Content -Path (Join-Path $InstallDir 'versao.txt') -Value $Version -Encoding UTF8
Write-Host '  OK - arquivos instalados.' -ForegroundColor Green

# ---------- 3. localiza navegador (modo aplicativo) ----------
Write-Host ' [3/6] Configurando o modo aplicativo...' -ForegroundColor Yellow
$candidatos = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$browser = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1
$indexUrl = 'file:///' + ((Join-Path $InstallDir 'index.html') -replace '\\', '/')
if ($browser) {
    Write-Host '  OK - navegador encontrado:' (Split-Path $browser -Leaf) '- o COTA abrira como aplicativo (sem barra de endereco).' -ForegroundColor Green
} else {
    Write-Host '  Aviso: Edge/Chrome nao encontrado - o COTA abrira no navegador padrao.' -ForegroundColor DarkYellow
}

# ---------- 4. atalho na Area de Trabalho ----------
Write-Host ' [4/6] Criando atalho na Area de Trabalho...' -ForegroundColor Yellow
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$icone = Join-Path $InstallDir 'assets\icon.ico'
$lnkPath = Join-Path $desktop 'COTA - Formacao CNC.lnk'
$lnk = $ws.CreateShortcut($lnkPath)
if ($browser) {
    $lnk.TargetPath  = $browser
    $lnk.Arguments   = "--app=`"$indexUrl`""
} else {
    $lnk.TargetPath  = (Join-Path $InstallDir 'index.html')
}
$lnk.WorkingDirectory = $InstallDir
$lnk.IconLocation     = "$icone,0"
$lnk.Description      = 'COTA - do desenho a peca pronta | Formacao em CAD + CNC'
$lnk.Save()
Write-Host '  OK - atalho criado com o icone do COTA.' -ForegroundColor Green

# ---------- 5. Menu Iniciar ----------
Write-Host ' [5/6] Criando entrada no Menu Iniciar...' -ForegroundColor Yellow
$startMenu = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Microsoft\Windows\Start Menu\Programs\COTA'
New-Item -ItemType Directory -Force -Path $startMenu | Out-Null

$appLnk = $ws.CreateShortcut((Join-Path $startMenu 'COTA - Formacao CNC.lnk'))
if ($browser) {
    $appLnk.TargetPath = $browser
    $appLnk.Arguments  = "--app=`"$indexUrl`""
} else {
    $appLnk.TargetPath = (Join-Path $InstallDir 'index.html')
}
$appLnk.WorkingDirectory = $InstallDir
$appLnk.IconLocation     = "$icone,0"
$appLnk.Description      = 'COTA - do desenho a peca pronta | Formacao em CAD + CNC'
$appLnk.Save()

$uninstallPs1 = Join-Path $InstallDir 'desinstalar-cota.ps1'
$uninstallBat = Join-Path $InstallDir 'desinstalar-cota.bat'

# ---------- 6. desinstalador ----------
Write-Host ' [6/6] Instalando o desinstalador...' -ForegroundColor Yellow
if (Test-Path (Join-Path $Src 'desinstalar-cota.ps1')) {
    Copy-Item (Join-Path $Src 'desinstalar-cota.ps1') $InstallDir -Force
    Copy-Item (Join-Path $Src 'desinstalar-cota.bat') $InstallDir -Force
} else {
    # gera o desinstalador caso nao esteja no pacote
    $uninstallScript = @'
#Requires -Version 5.1
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host 'Removendo o COTA deste computador...' -ForegroundColor Yellow
$ws = New-Object -ComObject WScript.Shell
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'COTA - Formacao CNC.lnk'
if (Test-Path $lnk) { Remove-Item $lnk -Force }
$startMenu = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Microsoft\Windows\Start Menu\Programs\COTA'
if (Test-Path $startMenu) { Remove-Item $startMenu -Recurse -Force }
$installDir = Join-Path $env:LOCALAPPDATA 'COTA'
Write-Host 'Atalhos removidos. Removendo arquivos instalados...' -ForegroundColor Yellow
Start-Process cmd -ArgumentList '/c', "ping 127.0.0.1 -n 3 >nul & rmdir /s /q `"$installDir`"" -WindowStyle Hidden
Write-Host 'COTA desinstalado com sucesso.' -ForegroundColor Green
'@
    Set-Content -Path $uninstallPs1 -Value $uninstallScript -Encoding UTF8
    $uninstallBatContent = "@echo off`r`ntitle COTA - Desinstalador`r`npowershell -NoProfile -ExecutionPolicy Bypass -File `"%~dp0desinstalar-cota.ps1`"`r`npause`r`n"
    Set-Content -Path $uninstallBat -Value $uninstallBatContent -Encoding ASCII
}

$unLnk = $ws.CreateShortcut((Join-Path $startMenu 'Desinstalar COTA.lnk'))
$unLnk.TargetPath = $uninstallBat
$unLnk.IconLocation = "$icone,0"
$unLnk.Description = 'Remove o COTA deste computador'
$unLnk.Save()

# ---------- resumo ----------
Write-Host ''
Write-Host '  ==========================================================' -ForegroundColor Green
Write-Host '   COTA instalado com sucesso!' -ForegroundColor Green
Write-Host '  ==========================================================' -ForegroundColor Green
Write-Host ''
Write-Host '   Onde encontrar o COTA:' -ForegroundColor White
Write-Host '     - Atalho "COTA - Formacao CNC" na Area de Trabalho'
Write-Host '     - Menu Iniciar > COTA'
Write-Host ''
Write-Host '   Acessos:' -ForegroundColor White
Write-Host '     - 10 exemplos de usinagem (codigo ISO + parametrico)'
Write-Host '     - Trilha de formacao: 6 modulos | 13 aulas | 64h'
Write-Host '     - Kit de 11 fichas de avaliacao + certificado'
Write-Host ''
Write-Host '   Para desinstalar: Menu Iniciar > COTA > Desinstalar COTA'
Write-Host ''
