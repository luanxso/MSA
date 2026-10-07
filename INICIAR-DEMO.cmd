@echo off
cd /d "%~dp0"
where node >nul 2>nul
if not errorlevel 1 (
  node scripts\serve-demo.mjs
) else (
  if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" scripts\serve-demo.mjs
  ) else (
    echo Instale Node.js e execute novamente este arquivo.
  )
)
pause
