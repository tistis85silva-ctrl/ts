@echo off
title COTA - Desinstalador
echo Removendo o COTA deste computador...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0desinstalar-cota.ps1"
echo.
pause
