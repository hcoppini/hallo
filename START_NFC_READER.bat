@echo off
title Halloween Party - ACR122U NFC Reader Bridge
color 0A

echo ==============================================================================
echo              HALLOWEEN PARTY - ACR122U NFC READER BRIDGE
echo ==============================================================================
echo.

:: 1. Navigate to hallo project directory
cd /d "%~dp0"
if not exist "nfc_bridge.py" (
    if exist "%USERPROFILE%\Desktop\hallo\nfc_bridge.py" (
        cd /d "%USERPROFILE%\Desktop\hallo"
    )
)

if not exist "nfc_bridge.py" (
    echo [ERROR] Could not find nfc_bridge.py!
    echo Please make sure the hallo folder is located on your Desktop.
    pause
    exit /b 1
)

:: 2. Terminate any previous stuck bridge process holding port 4567 or running nfc_bridge
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name LIKE 'python%'\" | Where-Object { $_.CommandLine -like '*nfc_bridge*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":4567" ^| findstr "LISTENING"') do (
    echo [INFO] Stopping previous bridge instance (PID %%a)...
    taskkill /F /PID %%a >nul 2>&1
)

:: 3. Detect Python interpreter
set "PY_CMD=py -3.12"
%PY_CMD% --version >nul 2>&1
if errorlevel 1 (
    set "PY_CMD=python"
    %PY_CMD% --version >nul 2>&1
    if errorlevel 1 (
        set "PY_CMD=py"
    )
)

:: 4. Verify required Python packages
%PY_CMD% -c "import smartcard, websockets" >nul 2>&1
if errorlevel 1 (
    echo [SETUP] Installing required libraries (pyscard, websockets)...
    %PY_CMD% -m pip install pyscard websockets
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies. Please check your internet connection.
        pause
        exit /b 1
    )
)

echo [OK] Python environment verified.
echo [OK] Reader bridge starting on ws://127.0.0.1:4567 + Supabase Cloud Relay...
echo.
echo ------------------------------------------------------------------------------
echo  KEEP THIS WINDOW OPEN while using the physical NFC reader!
echo  Minimizing this window is OK. Closing it will disconnect the reader.
echo ------------------------------------------------------------------------------
echo.

:: 5. Open Barman station in default browser automatically
start https://hallo-zkqp.vercel.app/barman

:: 6. Run the ultra-fast PC/SC reader bridge
%PY_CMD% nfc_bridge.py

echo.
echo [INFO] Bridge stopped.
pause
