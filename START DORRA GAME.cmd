@echo off
setlocal
title Dorra House Offline Server
cd /d "%~dp0"
color 0A

echo ================================================================
echo                     DORRA HOUSE - OFFLINE MODE
echo ================================================================
echo.
echo  IMPORTANT: Keep this window open while you are playing.
echo.
echo  This window runs a small local server on your computer so the
echo  game, images, buttons, and secure offline saves work correctly.
echo  It does not make the game public or require an internet connection.
echo.
echo  The game will open automatically in your web browser.
echo  If it does not open, use the local address shown below.
echo.
echo  When you are finished playing:
echo    - Close the game tab in your browser.
echo    - Press Ctrl+C here, then close this window.
echo.
echo  Closing this window stops the game server, but does not delete
echo  your saved profile or progress.
echo.
echo ================================================================
echo  Starting Dorra House...
echo ================================================================
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Node.js could not be found.
  echo This game needs its local offline server for secure saves and working buttons.
  pause
  exit /b 1
)
node.exe offline-server.js
if errorlevel 1 pause
