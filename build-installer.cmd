@echo off
set "PATH=C:\node-v26.13.0-win-x64;%PATH%"
cd /d "%~dp0"
call npm run dist:win
pause
