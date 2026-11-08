@echo off
setlocal
set "NODE_HOME=C:\Program Files\nodejs"
if not exist "%NODE_HOME%\node.exe" (
  echo Node.js was not found at "%NODE_HOME%\node.exe".
  echo Edit NODE_HOME in this file to match your Node.js installation path.
  pause
  exit /b 1
)
set "PATH=%NODE_HOME%;%PATH%"
cd /d "%~dp0"
if not exist "package.json" (
  echo package.json was not found. Keep this file inside the server folder.
  pause
  exit /b 1
)
call "%NODE_HOME%\npm.cmd" run dev
if errorlevel 1 (
  echo.
  echo The server exited with an error. Read the message above.
  pause
)
endlocal
