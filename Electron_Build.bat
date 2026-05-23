@echo off
setlocal EnableDelayedExpansion
title Electron Build Admin

:: ==============================
:: Check Admin Permission
:: ==============================
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo Restarting as Administrator...

    powershell -NoProfile -ExecutionPolicy Bypass ^
    -Command "Start-Process '%~f0' -Verb RunAs"

    exit /b
)

echo ==================================
echo Running as Administrator
echo ==================================
echo.

:: Move to current project directory
cd /d "%~dp0"

echo Current Directory:
echo %cd%
echo.

:: ==============================
:: Verify package.json exists
:: ==============================
if not exist package.json (
    echo ERROR: package.json not found
    pause
    exit /b 1
)

:: ==============================
:: Install dependencies only if needed
:: ==============================
if not exist node_modules (
    echo Installing dependencies...
    call npm install

    if errorlevel 1 (
        echo npm install failed
        pause
        exit /b 1
    )
)

:: ==============================
:: Electron Build
:: ==============================
echo Starting Electron Packaging...
echo.

:: Try dist script first
call npm run dist

:: fallback build script
if errorlevel 1 (
    echo dist failed, trying build...
    call npm run build
)

echo.
echo ==================================
echo Build Finished
echo ==================================
echo.

echo Output usually inside:
echo %cd%\dist

pause