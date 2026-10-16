@echo off
title COTA - Instalador para Windows
echo ============================================================
echo    COTA - do desenho a peca pronta
echo    Instalador para Windows ^| Formacao em CAD + CNC
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar-cota.ps1"
echo.
pause
