@echo off
title Halloween Bar Station Launcher
cd /d "%~dp0"

echo ========================================================
echo   HALLOWEEN BAR STATION (ACR122U NFC Terminal)
echo ========================================================
echo.

:: 1. Start Next.js dev server if not already running on port 3000
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %ERRORLEVEL% NEQ 0 (
    echo Starting Next.js server...
    start /min "Next.js Server" cmd /c "npm run dev"
    timeout /t 3 /nobreak >nul
) else (
    echo Next.js server is already active.
)

:: 2. Start NFC Hardware Bridge if not already running on port 4567
netstat -ano | findstr :4567 | findstr LISTENING >nul
if %ERRORLEVEL% NEQ 0 (
    echo Starting ACR122U NFC Bridge...
    start /min "ACR122U NFC Bridge" cmd /c "python nfc_bridge.py"
    timeout /t 1 /nobreak >nul
) else (
    echo ACR122U NFC Bridge is already active.
)

:: 3. Open Bar Station in borderless App Window mode
echo Opening dedicated Bar Station terminal...
where msedge >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    start msedge --app=http://localhost:3000/barman?pin=2113
) else (
    where chrome >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        start chrome --app=http://localhost:3000/barman?pin=2113
    ) else (
        start http://localhost:3000/barman?pin=2113
    )
)

echo.
echo ========================================================
echo   Bar Station is LIVE and ready for wristband taps!
echo ========================================================
