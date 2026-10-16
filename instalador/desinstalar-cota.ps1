#Requires -Version 5.1
# ============================================================
# COTA - Desinstalador para Windows
# ============================================================
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host ''
Write-Host '  Removendo o COTA deste computador...' -ForegroundColor Yellow

$ws = New-Object -ComObject WScript.Shell

# atalho da Area de Trabalho
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop 'COTA - Formacao CNC.lnk'
if (Test-Path $lnk) {
    Remove-Item $lnk -Force
    Write-Host '  OK - atalho da Area de Trabalho removido.' -ForegroundColor Green
}

# Menu Iniciar
$startMenu = Join-Path ([Environment]::GetFolderPath('ApplicationData')) 'Microsoft\Windows\Start Menu\Programs\COTA'
if (Test-Path $startMenu) {
    Remove-Item $startMenu -Recurse -Force
    Write-Host '  OK - entrada do Menu Iniciar removida.' -ForegroundColor Green
}

# arquivos instalados (remove apos a saida do PowerShell, pois o script roda de la)
$installDir = Join-Path $env:LOCALAPPDATA 'COTA'
if (Test-Path $installDir) {
    Write-Host '  OK - removendo arquivos instalados...' -ForegroundColor Green
    Start-Process cmd -ArgumentList '/c', "ping 127.0.0.1 -n 3 >nul & rmdir /s /q `"$installDir`"" -WindowStyle Hidden
}

Write-Host ''
Write-Host '  COTA desinstalado com sucesso.' -ForegroundColor Green
Write-Host '  (Obrigado por usar o COTA!)' -ForegroundColor Cyan
Write-Host ''
