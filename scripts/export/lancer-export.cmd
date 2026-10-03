@echo off
rem Lance l'export des donnees Speedfood et ajoute le resultat (compteurs seulement, aucune donnee
rem personnelle) au journal %USERPROFILE%\speedfood-exports\journal-export.log.
rem Utilise par la tache planifiee "Speedfood - export hebdomadaire" (voir docs/RUNBOOK-EXPORT.md).
setlocal
cd /d "%~dp0..\.."
if not exist "%USERPROFILE%\speedfood-exports" mkdir "%USERPROFILE%\speedfood-exports"
echo ===== %DATE% %TIME% ===== >> "%USERPROFILE%\speedfood-exports\journal-export.log"
node scripts\export\exporter.mjs >> "%USERPROFILE%\speedfood-exports\journal-export.log" 2>&1
set CODE=%ERRORLEVEL%
echo code de sortie : %CODE% >> "%USERPROFILE%\speedfood-exports\journal-export.log"
exit /b %CODE%
