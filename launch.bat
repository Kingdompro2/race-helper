@echo off
setlocal
title Nitrotype Bot - Launcher
cd /d "%~dp0"

echo ================================================
echo   Nitrotype Bot
echo ================================================
echo.
echo Closing any running Chrome windows...
taskkill /F /IM chrome.exe >nul 2>nul
timeout /t 2 /nobreak >nul

set "CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" set "CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if not exist "%CHROME_PATH%" (
    echo Could not find chrome.exe. Install Chrome, then re-run.
    pause
    exit /b 1
)

set "BOT_PROFILE=%USERPROFILE%\nitrotype-bot-chrome"

echo Launching Chrome with debug port 9222...
start "" "%CHROME_PATH%" --remote-debugging-port=9222 --user-data-dir="%BOT_PROFILE%" "https://www.nitrotype.com/race"

echo Waiting for Chrome to come up...
:waitloop
timeout /t 1 /nobreak >nul
curl -s http://localhost:9222/json/version >nul 2>nul
if errorlevel 1 goto waitloop

echo Chrome ready.
echo.
echo ================================================
echo   1. Log into nitrotype.com in the Chrome window (first time only).
echo   2. Click Race.
echo   3. Watch this window - bot will auto-type + fire nitros.
echo   4. Ctrl+C here to stop.
echo ================================================
echo.

node bot.mjs --mode=run
pause
