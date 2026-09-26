@echo off
setlocal
title Nitrotype Bot - Installer

echo ================================================
echo   Nitrotype Bot - one-time setup
echo ================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [1/4] Installing Node.js LTS via winget...
    winget install OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements --silent
    echo.
    echo Node installed. IMPORTANT: close this window and re-run install.bat
    echo so the PATH picks up node/npm.
    pause
    exit /b 0
) else (
    echo [1/4] Node.js already installed. OK.
)

where chrome >nul 2>nul
if errorlevel 1 (
    if not exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
        echo [2/4] Installing Google Chrome via winget...
        winget install Google.Chrome --accept-source-agreements --accept-package-agreements --silent
    ) else (
        echo [2/4] Chrome found at Program Files. OK.
    )
) else (
    echo [2/4] Chrome already on PATH. OK.
)

echo [3/4] Installing npm packages...
cd /d "%~dp0"
call npm install
if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
)

echo [4/4] Installing Playwright Chromium (backup)...
call npx playwright install chromium

echo.
echo ================================================
echo   Setup complete! Double-click launch.bat to play.
echo ================================================
pause
