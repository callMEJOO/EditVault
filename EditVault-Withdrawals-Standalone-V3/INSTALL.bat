@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0INSTALL.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed. Read the error message above.
  pause
  exit /b 1
)
echo.
pause
