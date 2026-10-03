@echo off
REM ============================================
REM  Lanceur RESEAU - Gestion Hospitaliere
REM  A utiliser sur le poste qui heberge les
REM  donnees pour les autres postes du reseau
REM  local (mode local / IndexedDB).
REM
REM  Ce poste devient le « poste serveur » de la
REM  synchronisation reseau :
REM   - il est accessible aux autres postes ;
REM   - il heberge la derniere image des
REM     donnees ;
REM   - il conserve le secret partage, masque
REM     dans cette fenetre (fichier
REM     build\.synchro\secret.txt). Pour
REM     l'afficher en clair, lancer :
REM     .\build\serveur.ps1 -Sync -ShowSecret
REM
REM  Sur les autres postes : utiliser lancer.bat
REM  (application seule), puis renseigner l'adresse
REM  affichee par ce poste dans Parametres >
REM  Synchro > Reseau local (role « Poste client »).
REM ============================================
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "build\serveur.ps1" -Sync
if errorlevel 1 pause
