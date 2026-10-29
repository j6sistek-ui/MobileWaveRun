@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required. See README.md for the container option.
  pause
  exit /b 1
)
if not exist node_modules\typescript\bin\tsc (
  call npm ci
  if errorlevel 1 exit /b 1
)
call npm run build
if errorlevel 1 exit /b 1
node scripts\serve.mjs --open
