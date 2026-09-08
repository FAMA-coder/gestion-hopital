@echo off
REM ============================================
REM  Lanceur Gestion Hospitaliere
REM  Demarre un serveur web local et ouvre
REM  l'application dans le navigateur.
REM  Necessite PowerShell 5.1+ (deja present
REM  sur Windows 10/11).
REM ============================================
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "build\serveur.ps1"
